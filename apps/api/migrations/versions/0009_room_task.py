"""add room task column

Revision ID: 0009_room_task
Revises: 0008_places
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_room_task"
down_revision: Union[str, None] = "0008_places"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rooms",
        sa.Column("task", sa.String(length=20), server_default="movies", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("rooms", "task")