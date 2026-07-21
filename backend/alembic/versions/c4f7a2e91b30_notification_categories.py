"""notification categories and per-category preferences

Adds the notification_category enum, per-category preference switches, a
user last_active_at signal, and generalises reminder_deliveries so it can carry
subscription-scoped and user-scoped notifications with a single dedupe key.

Revision ID: c4f7a2e91b30
Revises: b8e6d0f2a713
Create Date: 2026-07-21 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4f7a2e91b30"
down_revision: str | None = "b8e6d0f2a713"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


notification_category = sa.Enum(
    "renewal",
    "price_hike",
    "creature_health",
    "re_engagement",
    "weekly_digest",
    name="notification_category",
)

_CATEGORY_FLAGS = (
    "renewal_enabled",
    "price_hike_enabled",
    "creature_health_enabled",
    "re_engagement_enabled",
    "weekly_digest_enabled",
)


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    if is_postgres:
        notification_category.create(bind, checkfirst=True)

    # users.last_active_at
    op.add_column("users", sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_users_last_active_at"), "users", ["last_active_at"], unique=False)

    # notification_preferences: per-category switches + schedules
    for flag in _CATEGORY_FLAGS:
        op.add_column(
            "notification_preferences",
            sa.Column(flag, sa.Boolean(), server_default=sa.text("true"), nullable=False),
        )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "re_engagement_after_days", sa.Integer(), server_default=sa.text("7"), nullable=False
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column(
            "weekly_digest_weekday", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
    )
    op.add_column(
        "notification_preferences",
        sa.Column("weekly_digest_hour", sa.Integer(), server_default=sa.text("9"), nullable=False),
    )

    # reminder_deliveries: generalise to any category with a single dedupe key
    op.add_column(
        "reminder_deliveries",
        sa.Column(
            "category",
            notification_category,
            server_default="renewal",
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_reminder_deliveries_category"), "reminder_deliveries", ["category"], unique=False
    )
    op.add_column(
        "reminder_deliveries", sa.Column("dedupe_key", sa.String(length=200), nullable=True)
    )
    # Backfill a deterministic key for any pre-existing (renewal) rows.
    op.execute(
        "UPDATE reminder_deliveries SET dedupe_key = "
        "'renewal:' || channel || ':' || subscription_id || ':' || threshold_days || ':' || "
        "scheduled_for "
        "WHERE dedupe_key IS NULL"
    )
    if bind.dialect.name == "sqlite":
        # SQLite cannot alter nullability or table constraints in place.
        with op.batch_alter_table("reminder_deliveries") as batch_op:
            batch_op.alter_column("dedupe_key", existing_type=sa.String(length=200), nullable=False)
            batch_op.drop_constraint("uq_reminder_delivery_schedule", type_="unique")
            batch_op.create_unique_constraint(
                op.f("uq_reminder_deliveries_dedupe_key"), ["dedupe_key"]
            )
            batch_op.alter_column("subscription_id", existing_type=sa.Uuid(), nullable=True)
    else:
        op.alter_column("reminder_deliveries", "dedupe_key", nullable=False)
        op.drop_constraint("uq_reminder_delivery_schedule", "reminder_deliveries", type_="unique")
        op.create_unique_constraint(
            op.f("uq_reminder_deliveries_dedupe_key"), "reminder_deliveries", ["dedupe_key"]
        )
        op.alter_column(
            "reminder_deliveries", "subscription_id", existing_type=sa.Uuid(), nullable=True
        )


def downgrade() -> None:
    # User-scoped deliveries have no subscription and cannot be represented by
    # the previous schema. Remove them before restoring the NOT NULL constraint.
    op.execute("DELETE FROM reminder_deliveries WHERE subscription_id IS NULL")
    op.drop_index(op.f("ix_reminder_deliveries_category"), table_name="reminder_deliveries")
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("reminder_deliveries") as batch_op:
            batch_op.alter_column("subscription_id", existing_type=sa.Uuid(), nullable=False)
            batch_op.drop_constraint(op.f("uq_reminder_deliveries_dedupe_key"), type_="unique")
            batch_op.create_unique_constraint(
                "uq_reminder_delivery_schedule",
                ["subscription_id", "channel", "scheduled_for", "threshold_days"],
            )
            batch_op.drop_column("dedupe_key")
            batch_op.drop_column("category")
    else:
        op.alter_column(
            "reminder_deliveries", "subscription_id", existing_type=sa.Uuid(), nullable=False
        )
        op.drop_constraint(
            op.f("uq_reminder_deliveries_dedupe_key"), "reminder_deliveries", type_="unique"
        )
        op.create_unique_constraint(
            "uq_reminder_delivery_schedule",
            "reminder_deliveries",
            ["subscription_id", "channel", "scheduled_for", "threshold_days"],
        )
        op.drop_column("reminder_deliveries", "dedupe_key")
        op.drop_column("reminder_deliveries", "category")

    op.drop_column("notification_preferences", "weekly_digest_hour")
    op.drop_column("notification_preferences", "weekly_digest_weekday")
    op.drop_column("notification_preferences", "re_engagement_after_days")
    for flag in reversed(_CATEGORY_FLAGS):
        op.drop_column("notification_preferences", flag)

    op.drop_index(op.f("ix_users_last_active_at"), table_name="users")
    op.drop_column("users", "last_active_at")

    if op.get_bind().dialect.name == "postgresql":
        notification_category.drop(op.get_bind(), checkfirst=True)
