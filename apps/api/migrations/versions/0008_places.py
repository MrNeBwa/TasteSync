"""add places, place votes and place matches

Revision ID: 0008_places
Revises: 0007_movie_adult_flag
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0008_places"
down_revision: Union[str, None] = "0007_movie_adult_flag"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "places",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("city", sa.String(length=160), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("image_url", sa.String(length=1000), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("price_level", sa.String(length=20), nullable=True),
        sa.Column("cuisine", sa.String(length=300), nullable=True),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("website", sa.String(length=1000), nullable=True),
        sa.Column("phone", sa.String(length=60), nullable=True),
        sa.Column("opening_hours", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_id", name="uq_place_provider_id"),
    )

    op.create_table(
        "place_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("place_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["movie_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["place_id"], ["places.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "user_id", "place_id", name="uq_place_vote_once"),
    )
    op.create_index("ix_place_votes_session_id", "place_votes", ["session_id"], unique=False)
    op.create_index("ix_place_votes_place_id", "place_votes", ["place_id"], unique=False)

    op.create_table(
        "place_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("place_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["movie_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["place_id"], ["places.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "place_id", name="uq_place_match_session_place"),
    )
    op.create_index("ix_place_matches_session_id", "place_matches", ["session_id"], unique=False)
    op.create_index("ix_place_matches_place_id", "place_matches", ["place_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_place_matches_place_id", table_name="place_matches")
    op.drop_index("ix_place_matches_session_id", table_name="place_matches")
    op.drop_table("place_matches")
    op.drop_index("ix_place_votes_place_id", table_name="place_votes")
    op.drop_index("ix_place_votes_session_id", table_name="place_votes")
    op.drop_table("place_votes")
    op.drop_table("places")