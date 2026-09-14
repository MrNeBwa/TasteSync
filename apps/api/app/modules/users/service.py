from argon2 import PasswordHasher

from app.models.user import User
from app.repositories.user_repository import UserRepository


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
