"""add user birth date

Revision ID: 0006_user_birth_date
Revises: 0005_session_timestamps
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0006_user_birth_date"
down_revision: Union[str, None] = "0005_session_timestamps"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))

def downgrade() -> None:
    op.drop_column("users", "birth_date")
