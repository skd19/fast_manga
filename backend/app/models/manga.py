from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(120), unique=True, nullable=False, index=True)

    mangas = relationship("MangaCategory", back_populates="category")


class MangaCategory(Base):
    """Association table: Manga <-> Category (many-to-many)."""

    __tablename__ = "manga_categories"

    manga_id = Column(
        Integer, ForeignKey("mangas.id", ondelete="CASCADE"), primary_key=True
    )
    category_id = Column(
        Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )

    manga = relationship("Manga", back_populates="manga_categories")
    category = relationship("Category", back_populates="mangas")


class Manga(Base):
    __tablename__ = "mangas"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    slug = Column(String(300), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    cover_image = Column(String(500), nullable=True)
    author = Column(String(255), default="")
    artist = Column(String(255), default="")
    status = Column(
        String(20), default="ongoing"
    )  # ongoing/completed/cancelled/hiatus/not_yet_released
    average_rating = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    anilist_id = Column(Integer, unique=True, nullable=True, index=True)
    sources = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # FK to first & latest chapter (denormalised)
    first_chapter_id = Column(
        Integer,
        ForeignKey("chapters.id", use_alter=True, name="fk_manga_first_chapter"),
        nullable=True,
    )
    latest_chapter_id = Column(
        Integer,
        ForeignKey("chapters.id", use_alter=True, name="fk_manga_latest_chapter"),
        nullable=True,
    )

    # Relationships
    chapters = relationship(
        "Chapter",
        back_populates="manga",
        foreign_keys="Chapter.manga_id",
        cascade="all, delete-orphan",
        order_by="Chapter.number",
    )
    manga_categories = relationship(
        "MangaCategory", back_populates="manga", cascade="all, delete-orphan"
    )
    bookmarked_by = relationship(
        "Bookmark", back_populates="manga", cascade="all, delete-orphan"
    )
    ratings = relationship(
        "Rating", back_populates="manga", cascade="all, delete-orphan"
    )
    read_by_users = relationship(
        "ReadingHistory", back_populates="manga", cascade="all, delete-orphan"
    )
    scraper_errors = relationship(
        "ScraperError", back_populates="manga", cascade="all, delete-orphan"
    )

    first_chapter = relationship(
        "Chapter", foreign_keys=[first_chapter_id], post_update=True
    )
    latest_chapter = relationship(
        "Chapter", foreign_keys=[latest_chapter_id], post_update=True
    )

    @property
    def categories(self):
        return [mc.category for mc in self.manga_categories]


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    manga_id = Column(
        Integer, ForeignKey("mangas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number = Column(Numeric(6, 2), nullable=False)
    title = Column(String(200), default="")
    slug = Column(String(250), nullable=False)
    images_data = Column(JSON, default=list)  # list of image URLs / paths
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    manga = relationship("Manga", back_populates="chapters", foreign_keys=[manga_id])
    comments = relationship(
        "Comment", back_populates="chapter", cascade="all, delete-orphan"
    )
    read_progresses = relationship(
        "ChapterReadProgress", back_populates="chapter", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("manga_id", "number", name="uq_manga_chapter_number"),
        Index("ix_chapter_number", "number"),
    )


class ScraperError(Base):
    __tablename__ = "scraper_errors"

    id = Column(Integer, primary_key=True, index=True)
    manga_id = Column(
        Integer, ForeignKey("mangas.id", ondelete="CASCADE"), nullable=False
    )
    chapter_url = Column(String(500), nullable=False)
    chapter_number = Column(String(20), nullable=True)
    scraper_name = Column(String(50), nullable=False)
    error_message = Column(Text, default="")
    retry_count = Column(Integer, default=0)
    first_failed_at = Column(DateTime(timezone=True), server_default=func.now())
    last_failed_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    resolved = Column(Boolean, default=False)

    manga = relationship("Manga", back_populates="scraper_errors")

    __table_args__ = (
        UniqueConstraint("manga_id", "chapter_url", name="uq_manga_chapter_url"),
        Index("ix_scraper_manga_resolved", "manga_id", "resolved"),
        Index("ix_scraper_name_resolved", "scraper_name", "resolved"),
    )


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    chapter_id = Column(
        Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False
    )
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="comments")
    chapter = relationship("Chapter", back_populates="comments")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    manga_id = Column(
        Integer, ForeignKey("mangas.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookmarks")
    manga = relationship("Manga", back_populates="bookmarked_by")

    __table_args__ = (
        UniqueConstraint("user_id", "manga_id", name="uq_user_manga_bookmark"),
    )


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    manga_id = Column(
        Integer, ForeignKey("mangas.id", ondelete="CASCADE"), nullable=False
    )
    score = Column(Integer, nullable=False)  # 1-5
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ratings")
    manga = relationship("Manga", back_populates="ratings")

    __table_args__ = (
        UniqueConstraint("user_id", "manga_id", name="uq_user_manga_rating"),
    )


class ReadingHistory(Base):
    __tablename__ = "reading_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    manga_id = Column(
        Integer, ForeignKey("mangas.id", ondelete="CASCADE"), nullable=False
    )
    last_read_chapter_id = Column(
        Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True
    )
    last_read_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="reading_histories")
    manga = relationship("Manga", back_populates="read_by_users")
    last_read_chapter = relationship("Chapter")

    __table_args__ = (
        UniqueConstraint("user_id", "manga_id", name="uq_user_manga_history"),
        Index("ix_reading_history_user_manga", "user_id", "manga_id"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


class ChapterReadProgress(Base):
    __tablename__ = "chapter_read_progresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    chapter_id = Column(
        Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False
    )
    read_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chapter_read_progresses")
    chapter = relationship("Chapter", back_populates="read_progresses")

    __table_args__ = (
        UniqueConstraint("user_id", "chapter_id", name="uq_user_chapter_progress"),
    )
