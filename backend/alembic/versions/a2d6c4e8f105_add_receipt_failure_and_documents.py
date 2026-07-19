"""add receipt failure status and document input type

Revision ID: a2d6c4e8f105
Revises: c7d9e2a4b601
Create Date: 2026-07-18 23:45:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a2d6c4e8f105"
down_revision: str | None = "c7d9e2a4b601"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE rawinputtype ADD VALUE IF NOT EXISTS 'document'")
        op.execute("ALTER TYPE parsestatus ADD VALUE IF NOT EXISTS 'failed'")


def downgrade() -> None:
    # PostgreSQL enum value removal requires rebuilding every dependent column.
    # Retaining unused additive values is the safe rollback behavior.
    pass
