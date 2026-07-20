"""harden public-schema RLS and align SQLite receipt type

Revision ID: d1e5f7a9c304
Revises: b4f6c8d0e213
Create Date: 2026-07-18 23:58:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d1e5f7a9c304"
down_revision: str | None = "b4f6c8d0e213"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PUBLIC_TABLES = (
    "users",
    "subscriptions",
    "subscription_events",
    "parsed_receipts",
    "notification_preferences",
    "widget_tokens",
    "idempotency_keys",
    "clerk_webhook_events",
    "reminder_deliveries",
)


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        with op.batch_alter_table("parsed_receipts") as batch:
            batch.alter_column(
                "raw_input_type",
                existing_type=sa.String(length=5),
                type_=sa.String(length=8),
                existing_nullable=False,
            )
        return

    for table in PUBLIC_TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
        for role in ("anon", "authenticated"):
            op.execute(
                f"""DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                    EXECUTE 'REVOKE ALL ON TABLE public."{table}" FROM {role}';
                END IF;
                END $$"""
            )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        with op.batch_alter_table("parsed_receipts") as batch:
            batch.alter_column(
                "raw_input_type",
                existing_type=sa.String(length=8),
                type_=sa.String(length=5),
                existing_nullable=False,
            )
        return
    for table in reversed(PUBLIC_TABLES):
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')
