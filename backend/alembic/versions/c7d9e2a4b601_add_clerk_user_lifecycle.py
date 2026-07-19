"""add Clerk user lifecycle fields

Revision ID: c7d9e2a4b601
Revises: f4c2a1d8e703
Create Date: 2026-07-18 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c7d9e2a4b601"
down_revision: str | None = "f4c2a1d8e703"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(length=200), nullable=True))
    op.add_column("users", sa.Column("image_url", sa.String(length=1000), nullable=True))
    op.add_column("users", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_users_disabled_at"), "users", ["disabled_at"], unique=False)
    op.create_index(op.f("ix_users_deleted_at"), "users", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_deleted_at"), table_name="users")
    op.drop_index(op.f("ix_users_disabled_at"), table_name="users")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "disabled_at")
    op.drop_column("users", "image_url")
    op.drop_column("users", "display_name")
