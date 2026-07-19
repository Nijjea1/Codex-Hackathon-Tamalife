"""add durable reminder deliveries

Revision ID: e8b3f1a7c902
Revises: a2d6c4e8f105
Create Date: 2026-07-18 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e8b3f1a7c902"
down_revision: str | None = "a2d6c4e8f105"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


notification_channel = sa.Enum("push", "email", name="notification_channel")
reminder_delivery_status = sa.Enum(
    "pending",
    "processing",
    "retrying",
    "delivered",
    "canceled",
    "dead_letter",
    name="reminder_delivery_status",
)


def upgrade() -> None:
    op.create_table(
        "reminder_deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("channel", notification_channel, nullable=False),
        sa.Column("scheduled_for", sa.Date(), nullable=False),
        sa.Column("threshold_days", sa.Integer(), nullable=False),
        sa.Column("status", reminder_delivery_status, nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("provider_message_id", sa.String(length=300), nullable=True),
        sa.Column("request_id", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name=op.f("ck_reminder_deliveries_reminder_attempt_count_nonnegative"),
        ),
        sa.CheckConstraint(
            "max_attempts > 0", name=op.f("ck_reminder_deliveries_reminder_max_attempts_positive")
        ),
        sa.CheckConstraint(
            "threshold_days >= 0",
            name=op.f("ck_reminder_deliveries_reminder_threshold_nonnegative"),
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["subscriptions.id"],
            name=op.f("fk_reminder_deliveries_subscription_id_subscriptions"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_reminder_deliveries_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reminder_deliveries")),
        sa.UniqueConstraint(
            "subscription_id",
            "channel",
            "scheduled_for",
            "threshold_days",
            name="uq_reminder_delivery_schedule",
        ),
    )
    op.create_index(
        "ix_reminder_deliveries_due",
        "reminder_deliveries",
        ["status", "next_attempt_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reminder_deliveries_request_id"),
        "reminder_deliveries",
        ["request_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reminder_deliveries_scheduled_for"),
        "reminder_deliveries",
        ["scheduled_for"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reminder_deliveries_subscription_id"),
        "reminder_deliveries",
        ["subscription_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reminder_deliveries_user_id"),
        "reminder_deliveries",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_reminder_deliveries_user_id"), table_name="reminder_deliveries")
    op.drop_index(op.f("ix_reminder_deliveries_subscription_id"), table_name="reminder_deliveries")
    op.drop_index(op.f("ix_reminder_deliveries_scheduled_for"), table_name="reminder_deliveries")
    op.drop_index(op.f("ix_reminder_deliveries_request_id"), table_name="reminder_deliveries")
    op.drop_index("ix_reminder_deliveries_due", table_name="reminder_deliveries")
    op.drop_table("reminder_deliveries")
    if op.get_bind().dialect.name == "postgresql":
        reminder_delivery_status.drop(op.get_bind(), checkfirst=True)
        notification_channel.drop(op.get_bind(), checkfirst=True)
