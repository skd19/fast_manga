import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserCreate(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError(
                "Username may only contain letters, digits, underscores and hyphens"
            )
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address")
        return v


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_staff: bool
    is_superuser: bool
    avatar: Optional[str]
    bio: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def email_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address")
        return v


class PublicProfile(BaseModel):
    id: int
    username: str
    avatar: Optional[str]
    bio: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
