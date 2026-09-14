import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.security import decode_token
from app.db.session import get_db_session
from app.models.user import User
from app.modules.auth.schemas import (
    AuthUserResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.service import (
    AuthService,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UsernameAlreadyExistsError,
)
from app.repositories.user_repository import UserRepository

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> AuthUserResponse:
    service = AuthService(UserRepository(session))
    try:
        user = await service.register(
            username=payload.username,
            email=str(payload.email),
            password=payload.password,
        )
        await session.commit()
    except EmailAlreadyExistsError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Email already exists") from exc
    except UsernameAlreadyExistsError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Username already exists") from exc
    except Exception:
        await session.rollback()
        raise
    return AuthUserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    service = AuthService(UserRepository(session))
    try:
        user = await service.authenticate(email=str(payload.email), password=payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail="Invalid email or password") from exc
    access, refresh = service.issue_tokens(user)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    try:
        user_id = decode_token(payload.refresh_token, expected_type="refresh")
    except (jwt.InvalidTokenError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    access, refresh_token = AuthService(UserRepository(session)).issue_tokens(user)
    return TokenResponse(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=AuthUserResponse)
async def me(current_user: User = Depends(get_current_user)) -> AuthUserResponse:
    return AuthUserResponse.model_validate(current_user)
