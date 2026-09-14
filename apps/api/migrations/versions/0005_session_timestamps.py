"""add session lifecycle timestamps

Revision ID: 0005_session_timestamps
Revises: 0004_match_provider_key
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_session_timestamps"
down_revision: Union[str, None] = "0004_match_provider_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("movie_sessions", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("movie_sessions", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE movie_sessions SET started_at = created_at WHERE status IN ('ACTIVE','MATCHED','FINISHED') AND started_at IS NULL")
    op.execute("UPDATE movie_sessions SET finished_at = created_at WHERE status = 'FINISHED' AND finished_at IS NULL")

def downgrade() -> None:
    op.drop_column("movie_sessions", "finished_at")
    op.drop_column("movie_sessions", "started_at")
