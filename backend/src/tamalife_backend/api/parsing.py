from __future__ import annotations

import mimetypes
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import ValidationError

from tamalife_backend.api.dependencies import (
    ExtractorDep,
    LimiterDep,
    SessionDep,
    SettingsDep,
    StorageDep,
    UserDep,
)
from tamalife_backend.db.models import (
    EventType,
    ParsedReceipt,
    ParseStatus,
    RawInputType,
    Subscription,
    SubscriptionEvent,
)
from tamalife_backend.errors import ApiError
from tamalife_backend.schemas import ConfirmParseRequest, ExtractedReceipt, ParseResponse
from tamalife_backend.services.subscriptions import to_response

router = APIRouter(prefix="/parse", tags=["extraction"])


def parse_response(receipt: ParsedReceipt) -> ParseResponse:
    extracted = (
        ExtractedReceipt.model_validate(receipt.extracted_payload)
        if receipt.extracted_payload
        else None
    )
    return ParseResponse(
        id=receipt.id,
        input_type=receipt.raw_input_type,
        status=receipt.status,
        prompt_version=receipt.prompt_version,
        storage_path=receipt.storage_path,
        extracted=extracted,
        validation_errors=receipt.validation_errors,
        created_at=receipt.created_at,
    )


@router.post("", response_model=ParseResponse)
async def parse_document(
    session: SessionDep,
    user: UserDep,
    settings: SettingsDep,
    extractor: ExtractorDep,
    storage: StorageDep,
    limiter: LimiterDep,
    text: Annotated[str | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
) -> ParseResponse:
    if bool(text and text.strip()) == bool(image):
        raise ApiError("invalid_parse_input", "Provide exactly one of text or image", 400)
    await limiter.check(str(user.id))

    receipt = ParsedReceipt(
        id=uuid4(),
        user_id=user.id,
        raw_input_type=RawInputType.image if image else RawInputType.text,
        raw_text=text.strip() if text else None,
        status=ParseStatus.pending,
        prompt_version=settings.extraction_prompt_version,
    )
    session.add(receipt)
    await session.flush()

    image_data: bytes | None = None
    content_type = ""
    if image:
        content_type = image.content_type or "application/octet-stream"
        if content_type not in settings.allowed_upload_types:
            raise ApiError("unsupported_media_type", "Receipt file type is not supported", 415)
        image_data = await image.read(settings.max_upload_bytes + 1)
        if len(image_data) > settings.max_upload_bytes:
            raise ApiError("file_too_large", "Receipt file exceeds the upload limit", 413)
        extension = (
            mimetypes.guess_extension(content_type) or PurePosixPath(image.filename or "").suffix
        )
        path = f"{user.id}/{receipt.id}/original{extension}"
        receipt.storage_path = await storage.upload(path, image_data, content_type)

    errors: list[dict[str, object]] = []
    for attempt in range(2):
        try:
            extracted = (
                await extractor.extract_image(image_data, content_type)
                if image_data is not None
                else await extractor.extract_text(text or "")
            )
            receipt.extracted_payload = extracted.model_dump(mode="json")
            receipt.raw_model_response = receipt.extracted_payload
            receipt.confidence = extracted.confidence
            receipt.status = ParseStatus.completed
            await session.flush()
            return parse_response(receipt)
        except (ValueError, ValidationError) as exc:
            errors.append({"attempt": attempt + 1, "message": str(exc)[:1000]})

    receipt.status = ParseStatus.needs_review
    receipt.validation_errors = errors
    await session.flush()
    return parse_response(receipt)


@router.get("/{receipt_id}", response_model=ParseResponse)
async def get_parse(receipt_id: UUID, session: SessionDep, user: UserDep) -> ParseResponse:
    receipt = await session.get(ParsedReceipt, receipt_id)
    if receipt is None or receipt.user_id != user.id:
        raise ApiError("parse_not_found", "Parsed receipt was not found", 404)
    return parse_response(receipt)


@router.post("/{receipt_id}/confirm", response_model=dict, status_code=201)
async def confirm_parse(
    receipt_id: UUID, body: ConfirmParseRequest, session: SessionDep, user: UserDep
) -> dict[str, object]:
    receipt = await session.get(ParsedReceipt, receipt_id)
    if receipt is None or receipt.user_id != user.id:
        raise ApiError("parse_not_found", "Parsed receipt was not found", 404)
    if receipt.subscription_id:
        existing = await session.get(Subscription, receipt.subscription_id)
        if existing is None:
            raise ApiError("subscription_not_found", "Confirmed subscription was not found", 404)
        await session.refresh(existing, attribute_names=["events"])
        return {"subscription": to_response(existing).model_dump(mode="json")}

    extracted = body.extracted
    subscription = Subscription(
        user_id=user.id,
        vendor_name=extracted.vendor_name,
        display_name=extracted.display_name,
        item_type=extracted.item_type,
        category=extracted.category,
        amount=extracted.amount,
        previous_amount=extracted.previous_amount,
        currency=extracted.currency.upper(),
        billing_cycle=extracted.billing_cycle,
        renewal_or_expiry_date=extracted.renewal_or_expiry_date,
        cancellation_difficulty=extracted.cancellation_difficulty,
        creature_name=body.creature_name,
        creature_species=body.creature_species,
    )
    session.add(subscription)
    await session.flush()
    if extracted.previous_amount is not None and extracted.amount > extracted.previous_amount:
        session.add(
            SubscriptionEvent(
                subscription_id=subscription.id,
                event_type=EventType.price_hike_detected,
                data={
                    "previous_amount": str(extracted.previous_amount),
                    "new_amount": str(extracted.amount),
                    "currency": extracted.currency.upper(),
                    "source_parse_id": str(receipt.id),
                },
            )
        )
        await session.flush()
    receipt.subscription_id = subscription.id
    receipt.extracted_payload = extracted.model_dump(mode="json")
    receipt.status = ParseStatus.confirmed
    receipt.confirmed_at = datetime.now(UTC)
    await session.refresh(subscription, attribute_names=["events"])
    return {"subscription": to_response(subscription).model_dump(mode="json")}
