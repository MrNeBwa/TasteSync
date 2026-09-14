from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
from app.models.session import MovieSession, SessionStatus
from app.models.vote import Vote, VoteValue


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, session_id: UUID, *, for_update: bool = False) -> MovieSession | None:
        stmt = select(MovieSession).where(MovieSession.id == session_id)
        if for_update:
            stmt = stmt.with_for_update()
        return await self.session.scalar(stmt)

    async def get_active_for_room(self, room_id: UUID) -> MovieSession | None:
        stmt = (
            select(MovieSession)
            .where(
                MovieSession.room_id == room_id,
                MovieSession.status.in_([
                    SessionStatus.CREATED,
                    SessionStatus.ACTIVE,
                    SessionStatus.MATCHED,
                ]),
            )
            .order_by(MovieSession.created_at.desc())
        )
        return await self.session.scalar(stmt)

    async def create_vote(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        movie_id: UUID,
        value: VoteValue,
    ) -> Vote:
        vote = Vote(session_id=session_id, user_id=user_id, movie_id=movie_id, value=value)
        self.session.add(vote)
        return vote

    async def get_vote(self, *, session_id: UUID, user_id: UUID, movie_id: UUID) -> Vote | None:
        stmt = select(Vote).where(
            Vote.session_id == session_id,
            Vote.user_id == user_id,
            Vote.movie_id == movie_id,
        )
        return await self.session.scalar(stmt)

    async def voted_movie_ids(self, *, session_id: UUID, user_id: UUID) -> set[UUID]:
        stmt = select(Vote.movie_id).where(
            Vote.session_id == session_id,
            Vote.user_id == user_id,
        ).distinct()
        return set(await self.session.scalars(stmt))

    async def count_likes(
        self,
        *,
        session_id: UUID,
        movie_id: UUID,
        user_ids: list[UUID],
    ) -> int:
        stmt = select(func.count()).select_from(Vote).where(
            Vote.session_id == session_id,
            Vote.movie_id == movie_id,
            Vote.user_id.in_(user_ids),
            Vote.value == VoteValue.LIKE,
        )
        return int(await self.session.scalar(stmt) or 0)

    async def get_match(self, *, session_id: UUID, movie_id: UUID) -> Match | None:
        stmt = select(Match).where(
            Match.session_id == session_id,
            Match.movie_id == movie_id,
        )
        return await self.session.scalar(stmt)


    async def list_matches(self, *, session_id: UUID) -> list[Match]:
        stmt = (
            select(Match)
            .where(Match.session_id == session_id)
            .order_by(Match.created_at.asc())
        )
        return list(await self.session.scalars(stmt))

    async def create_match(self, *, session_id: UUID, movie_id: UUID) -> Match:
        match = Match(session_id=session_id, movie_id=movie_id)
        self.session.add(match)
        return match
