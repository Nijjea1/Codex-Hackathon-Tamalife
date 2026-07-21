"""add catalog publication state

Revision ID: c9d7e3f5a604
Revises: a7c5e1d9f402
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c9d7e3f5a604"
down_revision: str | None = "a7c5e1d9f402"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("provider_plans") as batch:
        batch.add_column(
            sa.Column(
                "missing_observation_count",
                sa.Integer(),
                server_default="0",
                nullable=False,
            )
        )
        batch.create_check_constraint(
            op.f("ck_provider_plans_missing_observation_count_nonnegative"),
            "missing_observation_count >= 0",
        )
    op.add_column(
        "source_fetches",
        sa.Column("publication_completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("source_fetches", "publication_completed_at")
    with op.batch_alter_table("provider_plans") as batch:
        batch.drop_constraint(
            op.f("ck_provider_plans_missing_observation_count_nonnegative"),
            type_="check",
        )
        batch.drop_column("missing_observation_count")
