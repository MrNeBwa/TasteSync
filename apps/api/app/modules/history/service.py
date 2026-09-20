from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie
from app.models.room import Room
from app.repositories.movie_repository import MovieRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.session_repository import SessionRepository


@dataclass
class HistoryItem:
    room: Room
    member_count: int
    matched_movies: list[Movie]


class HistoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.rooms = RoomRepository(session)
        self.sessions = SessionRepository(session)
        self.movies = MovieRepository(session)

    async def user_history(self, *, user_id: UUID, limit: int = 10) -> list[HistoryItem]:
        rooms = await self.rooms.list_for_user(user_id=user_id, limit=limit)
        latest_by_room = await self.sessions.latest_for_rooms([room.id for room in rooms])
        matches_by_session = await self.sessions.matches_for_sessions(
            [movie_session.id for movie_session in latest_by_room.values()]
        )
        movie_ids = {match.movie_id for matches in matches_by_session.values() for match in matches}
        movies_by_id = {movie.id: movie for movie in await self.movies.get_by_ids(movie_ids)}

        items: list[HistoryItem] = []
        for room in rooms:
            movie_session = latest_by_room.get(room.id)
            matched_movies: list[Movie] = []
            if movie_session is not None:
                for match in matches_by_session.get(movie_session.id, []):
                    movie = movies_by_id.get(match.movie_id)
                    if movie is not None:
                        matched_movies.append(movie)
            items.append(
                HistoryItem(
                    room=room,
                    member_count=len(room.members),
                    matched_movies=matched_movies,
                )
            )
        return items
