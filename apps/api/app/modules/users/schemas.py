from uuid import UUID

from datetime import date

from pydantic import BaseModel, EmailStr, Field


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    birth_date: date | None = None

    model_config = {"from_attributes": True}


class UpdateAgeRequest(BaseModel):
    birth_date: date = Field(description="User date of birth")
