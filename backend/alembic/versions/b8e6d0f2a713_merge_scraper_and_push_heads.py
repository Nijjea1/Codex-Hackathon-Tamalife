"""merge scraper and push notification heads

Revision ID: b8e6d0f2a713
Revises: c9d7e3f5a604, f1a4c9d6b820
Create Date: 2026-07-20
"""

from collections.abc import Sequence

revision: str = "b8e6d0f2a713"
down_revision: tuple[str, str] = ("c9d7e3f5a604", "f1a4c9d6b820")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
