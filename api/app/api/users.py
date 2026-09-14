from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.modules.users.schemas import CreateUserRequest, UpdateAgeRequest, UserResponse

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


@router.patch("/me/age", response_model=UserResponse)
async def update_my_age(
    payload: UpdateAgeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    if payload.birth_date > date.today():
        raise HTTPException(status_code=422, detail="Birth date cannot be in the future")
    today = date.today()
    age = today.year - payload.birth_date.year - ((today.month, today.day) < (payload.birth_date.month, payload.birth_date.day))
    if age < 1 or age > 120:
        raise HTTPException(status_code=422, detail="Invalid age")
    current_user.birth_date = payload.birth_date
    await session.commit()
    return UserResponse.model_validate(current_user)
