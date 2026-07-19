import logging
import re
import sys
from collections.abc import MutableMapping
from typing import Any

import structlog

SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "password",
    "secret",
    "secret_key",
    "service_key",
    "token",
    "webhook_signing_secret",
}
BEARER_PATTERN = re.compile(r"(?i)bearer\s+[a-z0-9._~+/=-]+")
URL_PASSWORD_PATTERN = re.compile(r"(?i)(postgres(?:ql)?(?:\+asyncpg)?://[^:/\s]+:)[^@\s]+(@)")


def _redact(value: Any, key: str = "") -> Any:
    if key.lower() in SENSITIVE_KEYS or any(word in key.lower() for word in ("token", "secret")):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {item_key: _redact(item, str(item_key)) for item_key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_redact(item) for item in value]
    if isinstance(value, str):
        value = BEARER_PATTERN.sub("Bearer [REDACTED]", value)
        return URL_PASSWORD_PATTERN.sub(r"\1[REDACTED]\2", value)
    return value


def redact_sensitive(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    redacted = _redact(dict(event_dict))
    return redacted if isinstance(redacted, dict) else event_dict


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(stream=sys.stdout, level=level.upper(), format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            redact_sensitive,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
