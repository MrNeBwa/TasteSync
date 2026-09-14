from datetime import timedelta

from app.core.config import get_settings
from app.core.security import create_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository


class AuthError(Exception):
    pass


class EmailAlreadyExistsError(AuthError):
    pass


class UsernameAlreadyExistsError(AuthError):
    pass


class InvalidCredentialsError(AuthError):
    pass


class AuthService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository
        self.settings = get_settings()

    async def register(self, *, username: str, email: str, password: str) -> User:
        email = email.lower()
        username = username.strip()
        if await self.repository.get_by_email(email):
            raise EmailAlreadyExistsError
        if await self.repository.get_by_username(username):
            raise UsernameAlreadyExistsError
        user = await self.repository.create_user(
            username=username,
            email=email,
            password_hash=hash_password(password),
        )
        return user

    async def authenticate(self, *, email: str, password: str) -> User:
        user = await self.repository.get_by_email(email.lower())
        if user is None or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError
        return user

    def issue_tokens(self, user: User) -> tuple[str, str]:
        access = create_token(
            user.id,
            token_type="access",
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes),
        )
        refresh = create_token(
            user.id,
            token_type="refresh",
            expires_delta=timedelta(days=self.settings.refresh_token_expire_days),
        )
        return access, refresh
