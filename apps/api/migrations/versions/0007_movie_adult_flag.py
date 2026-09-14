"""add movie adult flag

Revision ID: 0007_movie_adult_flag
Revises: 0006_user_birth_date
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0007_movie_adult_flag"
down_revision: Union[str, None] = "0006_user_birth_date"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("movies", sa.Column("is_adult", sa.Boolean(), server_default=sa.false(), nullable=False))

def downgrade() -> None:
    op.drop_column("movies", "is_adult")
