"""add match table and make movie provider id composite unique

Revision ID: 0004_match_provider_key
Revises: 0003_movies_and_sessions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_match_provider_key"
down_revision: Union[str, None] = "0003_movies_and_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing deployment is expected to contain one provider today.
    # Remove old global uniqueness and replace it with provider + provider_id.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'movies'::regclass
                  AND conname = 'movies_provider_id_key'
            ) THEN
                ALTER TABLE movies DROP CONSTRAINT movies_provider_id_key;
            END IF;
        END $$;
    """)
    op.create_unique_constraint("uq_movie_provider_id", "movies", ["provider", "provider_id"])

    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("movie_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["movie_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["movie_id"], ["movies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "movie_id", name="uq_match_session_movie"),
    )
    op.create_index("ix_matches_session_id", "matches", ["session_id"], unique=False)
    op.create_index("ix_matches_movie_id", "matches", ["movie_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_matches_movie_id", table_name="matches")
    op.drop_index("ix_matches_session_id", table_name="matches")
    op.drop_table("matches")
    op.drop_constraint("uq_movie_provider_id", "movies", type_="unique")
    op.create_unique_constraint("movies_provider_id_key", "movies", ["provider_id"])
