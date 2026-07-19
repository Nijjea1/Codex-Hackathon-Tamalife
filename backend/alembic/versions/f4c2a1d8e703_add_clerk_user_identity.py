"""add Clerk identity to users

Revision ID: f4c2a1d8e703
Revises: 6a4d7e9b2c10
Create Date: 2026-07-18 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f4c2a1d8e703"
down_revision: str | None = "6a4d7e9b2c10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("clerk_user_id", sa.String(length=200), nullable=True))
    op.create_index(
        op.f("ix_users_clerk_user_id"),
        "users",
        ["clerk_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_clerk_user_id"), table_name="users")
    op.drop_column("users", "clerk_user_id")
