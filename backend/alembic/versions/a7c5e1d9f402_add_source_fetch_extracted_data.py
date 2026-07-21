"""add source fetch extracted data

Revision ID: a7c5e1d9f402
Revises: ece2779ead19
Create Date: 2026-07-20
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "a7c5e1d9f402"
down_revision: Union[str, None] = "ece2779ead19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("source_fetches", sa.Column("extracted_data", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("source_fetches", "extracted_data")
