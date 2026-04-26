from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    avatar = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    comments = relationship(
        "Comment", back_populates="user", cascade="all, delete-orphan"
    )
    bookmarks = relationship(
        "Bookmark", back_populates="user", cascade="all, delete-orphan"
    )
    ratings = relationship(
        "Rating", back_populates="user", cascade="all, delete-orphan"
    )
    reading_histories = relationship(
        "ReadingHistory", back_populates="user", cascade="all, delete-orphan"
    )
    notifications = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )
    chapter_read_progresses = relationship(
        "ChapterReadProgress", back_populates="user", cascade="all, delete-orphan"
    )
    staff_profile = relationship(
        "StaffUser",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )

    @property
    def is_staff(self) -> bool:
        return self.__dict__.get("staff_profile") is not None

    @property
    def is_superuser(self) -> bool:
        staff_profile = self.__dict__.get("staff_profile")
        return bool(staff_profile and staff_profile.is_superuser)


class StaffUser(Base):
    __tablename__ = "staff_users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    is_superuser = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="staff_profile")
