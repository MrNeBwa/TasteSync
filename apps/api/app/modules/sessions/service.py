from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from app.models.room import RoomStatus
from app.models.session import MovieSession, SessionStatus
from app.models.vote import VoteValue
from app.modules.places.service import PlaceNotFoundError
from app.repositories.movie_repository import MovieRepository
from app.repositories.place_repository import PlaceRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.session_repository import SessionRepository


class SessionNotFoundError(Exception):
    pass


class SessionNotActiveError(Exception):
    pass


class SessionNotMemberError(Exception):
    pass


class MovieNotFoundError(Exception):
    pass


class DuplicateVoteError(Exception):
    pass


class CannotStartSessionError(Exception):
    pass


class CannotFinishSessionError(Exception):
    pass


class MovieSessionService:
    def __init__(
        self,
        session_repository: SessionRepository,
        room_repository: RoomRepository,
        movie_repository: MovieRepository,
        place_repository: PlaceRepository | None = None,
    ) -> None:
        self.sessions = session_repository
        self.rooms = room_repository
        self.movies = movie_repository
        self.places = place_repository or PlaceRepository(session_repository.session)
        self.db = session_repository.session

    async def create_for_room(self, *, room_id: UUID, user_id: UUID) -> MovieSession:
        # Lock the room for the entire state transition. This prevents two
        # concurrent start requests from creating two active sessions.
        room = await self.rooms.get_by_id(room_id, with_members=True, for_update=True)
        if room is None:
            raise SessionNotFoundError
        if room.owner_id != user_id:
            raise CannotStartSessionError("Only the room owner can start the session")
        if room.status != RoomStatus.READY:
            raise CannotStartSessionError("All members must be ready before starting")

        existing = await self.sessions.get_active_for_room(room_id)
        if existing is not None:
            return existing

        movie_session = MovieSession(
            id=uuid4(),
            room_id=room_id,
            status=SessionStatus.ACTIVE,
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(movie_session)
        room.status = RoomStatus.ACTIVE
        await self.db.flush()
        return movie_session

    async def get_for_member(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        for_update: bool = False,
    ) -> MovieSession:
        movie_session = await self.sessions.get_by_id(session_id, for_update=for_update)
        if movie_session is None:
            raise SessionNotFoundError
        if await self.rooms.get_membership(movie_session.room_id, user_id) is None:
            raise SessionNotMemberError
        return movie_session

    async def recommendations(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        limit: int = 10,
        exploration_ratio: float = 0.25,
    ):
        movie_session = await self.get_for_member(session_id=session_id, user_id=user_id)
        if movie_session.status != SessionStatus.ACTIVE:
            raise SessionNotActiveError

        members = await self.rooms.list_members(movie_session.room_id)
        user_ids = [member.user_id for member in members]
        users = []
        for uid in user_ids:
            user = await self.rooms.get_user(uid)
            if user is not None:
                users.append(user)
        today = date.today()
        adult_allowed = all(
            user.birth_date is not None
            and (today.year - user.birth_date.year - ((today.month, today.day) < (user.birth_date.month, user.birth_date.day))) >= 18
            for user in users
        ) if users else False
        # A movie remains visible to other participants until THEY vote on it.
        excluded = await self.sessions.voted_movie_ids(
            session_id=session_id,
            user_id=user_id,
        )

        from app.modules.recommendations.service import RecommendationService

        return await RecommendationService(self.movies).next_movies(
            session_id=session_id,
            user_ids=user_ids,
            exclude_movie_ids=excluded,
            limit=limit,
            exploration_ratio=exploration_ratio,
            include_adult=adult_allowed,
        )

    async def vote(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        movie_id: UUID,
        value: VoteValue,
    ):
        # Lock the session so the final votes for the same movie are serialized.
        movie_session = await self.get_for_member(
            session_id=session_id,
            user_id=user_id,
            for_update=True,
        )
        if movie_session.status != SessionStatus.ACTIVE:
            raise SessionNotActiveError

        movie = await self.movies.get_by_id(movie_id)
        if movie is None:
            raise MovieNotFoundError

        if await self.sessions.get_vote(
            session_id=session_id,
            user_id=user_id,
            movie_id=movie_id,
        ) is not None:
            raise DuplicateVoteError

        vote = await self.sessions.create_vote(
            session_id=session_id,
            user_id=user_id,
            movie_id=movie_id,
            value=value,
        )
        await self.db.flush()

        match = None
        if value == VoteValue.LIKE:
            members = await self.rooms.list_members(movie_session.room_id)
            user_ids = [member.user_id for member in members]
            likes = await self.sessions.count_likes(
                session_id=session_id,
                movie_id=movie_id,
                user_ids=user_ids,
            )

            if user_ids and likes == len(user_ids):
                match = await self.sessions.get_match(
                    session_id=session_id,
                    movie_id=movie_id,
                )
                if match is None:
                    match = await self.sessions.create_match(
                        session_id=session_id,
                        movie_id=movie_id,
                    )
                    await self.db.flush()

                movie_session.status = SessionStatus.MATCHED
                room = await self.rooms.get_by_id(movie_session.room_id, for_update=True)
                if room is not None:
                    room.status = RoomStatus.MATCH_FOUND
                await self.db.flush()

        return vote, match

    async def vote_place(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        place_id: UUID,
        value: VoteValue,
    ):
        movie_session = await self.get_for_member(
            session_id=session_id,
            user_id=user_id,
            for_update=True,
        )
        if movie_session.status != SessionStatus.ACTIVE:
            raise SessionNotActiveError

        place = await self.places.get_by_id(place_id)
        if place is None:
            raise PlaceNotFoundError

        if await self.places.get_vote(
            session_id=session_id,
            user_id=user_id,
            place_id=place_id,
        ) is not None:
            raise DuplicateVoteError

        vote = await self.places.create_vote(
            session_id=session_id,
            user_id=user_id,
            place_id=place_id,
            value=value,
        )
        await self.db.flush()

        match = None
        if value == VoteValue.LIKE:
            members = await self.rooms.list_members(movie_session.room_id)
            user_ids = [member.user_id for member in members]
            likes = await self.places.count_likes(
                session_id=session_id,
                place_id=place_id,
                user_ids=user_ids,
            )

            if user_ids and likes == len(user_ids):
                match = await self.places.get_match(
                    session_id=session_id,
                    place_id=place_id,
                )
                if match is None:
                    match = await self.places.create_match(
                        session_id=session_id,
                        place_id=place_id,
                    )

                movie_session.status = SessionStatus.MATCHED
                room = await self.rooms.get_by_id(movie_session.room_id, for_update=True)
                if room is not None:
                    room.status = RoomStatus.MATCH_FOUND
                await self.db.flush()

        return vote, match

    async def finish(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
    ) -> MovieSession:
        movie_session = await self.get_for_member(
            session_id=session_id,
            user_id=user_id,
            for_update=True,
        )
        room = await self.rooms.get_by_id(movie_session.room_id, for_update=True)
        if room is None:
            raise SessionNotFoundError
        if room.owner_id != user_id:
            raise CannotFinishSessionError("Only the room owner can finish the session")
        if movie_session.status not in {SessionStatus.ACTIVE, SessionStatus.MATCHED}:
            raise CannotFinishSessionError("Session is already finished")

        movie_session.status = SessionStatus.FINISHED
        movie_session.finished_at = datetime.now(timezone.utc)
        if room.status in {RoomStatus.ACTIVE, RoomStatus.MATCH_FOUND}:
            room.status = RoomStatus.FINISHED
        await self.db.flush()
        return movie_session
