"""add widget token scope

Revision ID: b4f6c8d0e213
Revises: e8b3f1a7c902
Create Date: 2026-07-18

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b4f6c8d0e213"
down_revision: Union[str, Sequence[str], None] = "e8b3f1a7c902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "widget_tokens",
        sa.Column(
            "scope",
            sa.String(length=40),
            server_default="widget:read",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("widget_tokens", "scope")
