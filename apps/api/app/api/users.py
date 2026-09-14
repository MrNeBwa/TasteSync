from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.users.schemas import CreateUserRequest, UserResponse
from app.modules.users.service import UserService
from app.repositories.user_repository import UserRepository

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, deprecated=True)
async def create_user(
    payload: CreateUserRequest,
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    service = UserService(UserRepository(session))
    try:
        user = await service.create_user(
            username=payload.username,
            email=str(payload.email),
            password=payload.password,
        )
        await session.commit()
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Username or email already exists") from exc
    return UserResponse.model_validate(user)
