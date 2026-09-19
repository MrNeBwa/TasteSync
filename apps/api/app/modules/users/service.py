from __future__ import annotations

from argon2 import PasswordHasher

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository


class PasswordMismatchError(Exception):
    pass


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository
        self.password_hasher = PasswordHasher()

    async def create_user(self, *, username: str, email: str, password: str) -> User:
        password_hash = self.password_hasher.hash(password)
        return await self.repository.create_user(
            username=username.strip(),
            email=email.lower(),
            password_hash=password_hash,
        )

    async def change_password(
        self,
        *,
        user: User,
        current_password: str,
        new_password: str,
    ) -> User:
        if not verify_password(current_password, user.password_hash):
            raise PasswordMismatchError("Current password is incorrect")
        user.password_hash = hash_password(new_password)
        await self.repository.session.flush()
        return user
