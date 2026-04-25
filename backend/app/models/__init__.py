# Import all models here so that:
#   1. They are accessible via `from app.models import <Model>`
#   2. Alembic's autogenerate can discover every table through Base.metadata

from app.models.manga import (  # noqa: F401
    Bookmark,
    Category,
    Chapter,
    ChapterReadProgress,
    Comment,
    Manga,
    MangaCategory,
    Notification,
    Rating,
    ReadingHistory,
    ScraperError,
)
from app.models.user import User  # noqa: F401

__all__ = [
    "User",
    "Category",
    "MangaCategory",
    "Manga",
    "Chapter",
    "ScraperError",
    "Comment",
    "Bookmark",
    "Rating",
    "ReadingHistory",
    "Notification",
    "ChapterReadProgress",
]
