"""add google photos columns for places

Revision ID: 0010_place_photos
Revises: 0009_room_task
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_place_photos"
down_revision: Union[str, None] = "0009_room_task"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "places",
        sa.Column("google_place_id", sa.String(length=256), nullable=True),
    )
    op.add_column(
        "places",
        sa.Column("google_photo_ref", sa.String(length=256), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("places", "google_photo_ref")
    op.drop_column("places", "google_place_id")