from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.modules.history.schemas import HistoryResponse, HistoryRoomItem
from app.modules.history.service import HistoryService
from app.modules.movies.schemas import to_movie_response

router = APIRouter(prefix="/me", tags=["history"])


@router.get("/history", response_model=HistoryResponse)
async def my_history(
    limit: int = Query(default=6, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> HistoryResponse:
    service = HistoryService(session)
    items = await service.user_history(user_id=current_user.id, limit=limit)
    return HistoryResponse(
        items=[
            HistoryRoomItem(
                room_id=item.room.id,
                room_name=item.room.name,
                room_code=item.room.code,
                room_status=item.room.status,
                created_at=item.room.created_at,
                member_count=item.member_count,
                matched_movies=[to_movie_response(movie) for movie in item.matched_movies],
            )
            for item in items
        ]
    )
