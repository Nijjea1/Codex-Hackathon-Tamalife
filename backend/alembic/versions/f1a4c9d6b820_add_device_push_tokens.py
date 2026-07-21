"""add device push tokens

Revision ID: f1a4c9d6b820
Revises: d1e5f7a9c304
Create Date: 2026-07-20 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f1a4c9d6b820"
down_revision: str | None = "d1e5f7a9c304"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


device_platform = sa.Enum("ios", "android", name="device_platform")


def upgrade() -> None:
    bind = op.get_bind()
    op.create_table(
        "device_push_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("platform", device_platform, nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_device_push_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_device_push_tokens")),
        sa.UniqueConstraint("token", name=op.f("uq_device_push_tokens_token")),
    )
    op.create_index(
        op.f("ix_device_push_tokens_user_id"), "device_push_tokens", ["user_id"], unique=False
    )

    if bind.dialect.name != "postgresql":
        return

    op.execute('ALTER TABLE public."device_push_tokens" ENABLE ROW LEVEL SECURITY')
    for role in ("anon", "authenticated"):
        op.execute(
            f"""DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                EXECUTE 'REVOKE ALL ON TABLE public."device_push_tokens" FROM {role}';
            END IF;
            END $$"""
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_device_push_tokens_user_id"), table_name="device_push_tokens")
    op.drop_table("device_push_tokens")
    if op.get_bind().dialect.name == "postgresql":
        device_platform.drop(op.get_bind(), checkfirst=True)
