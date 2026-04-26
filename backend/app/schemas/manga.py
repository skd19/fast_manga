from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    slug: str


class CategoryOut(CategoryBase):
    id: int
    model_config = {"from_attributes": True}


class ChapterBase(BaseModel):
    number: Decimal
    title: str = ""
    slug: str = ""


class ChapterOut(ChapterBase):
    id: int
    manga_id: int
    images_data: List[Any] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChapterListItem(BaseModel):
    """Lightweight chapter listing (no images_data)."""

    id: int
    number: Decimal
    title: str
    slug: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MangaBase(BaseModel):
    title: str
    slug: str
    description: str = ""
    author: str = ""
    artist: str = ""
    status: str = "ongoing"


class MangaListItem(BaseModel):
    id: int
    title: str
    slug: str
    cover_image: Optional[str]
    status: str
    average_rating: float
    rating_count: int
    updated_at: datetime
    latest_chapter: Optional[ChapterListItem] = None

    model_config = {"from_attributes": True}


class MangaDetail(MangaBase):
    id: int
    cover_image: Optional[str]
    average_rating: float
    rating_count: int
    anilist_id: Optional[int]
    sources: List[Any] = []
    created_at: datetime
    updated_at: datetime
    categories: List[CategoryOut] = []
    first_chapter: Optional[ChapterListItem] = None
    latest_chapter: Optional[ChapterListItem] = None

    model_config = {"from_attributes": True}


class MangaCreate(BaseModel):
    title: str
    description: str = ""
    author: str = ""
    artist: str = ""
    status: str = "ongoing"
    anilist_id: Optional[int] = None
    sources: List[Any] = []
    category_ids: List[int] = []


class MangaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    artist: Optional[str] = None
    status: Optional[str] = None
    anilist_id: Optional[int] = None
    sources: Optional[List[Any]] = None
    category_ids: Optional[List[int]] = None


class CommentOut(BaseModel):
    id: int
    user_id: Optional[int]
    chapter_id: int
    text: str
    created_at: datetime
    username: Optional[str] = None
    user_avatar: Optional[str] = None

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str


class BookmarkOut(BaseModel):
    id: int
    manga_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RatingCreate(BaseModel):
    score: int

    @classmethod
    def __get_validators__(cls):
        yield cls.validate_score

    @staticmethod
    def validate_score(v):
        if not (1 <= v <= 5):
            raise ValueError("Score must be between 1 and 5")
        return v


class RatingOut(BaseModel):
    id: int
    manga_id: int
    score: int
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReadingHistoryOut(BaseModel):
    id: int
    manga_id: int
    manga_title: Optional[str] = None
    manga_slug: Optional[str] = None
    last_read_chapter_id: Optional[int]
    last_read_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        if instance.manga_title is None and hasattr(obj, "manga") and obj.manga:
            instance.manga_title = obj.manga.title
        if instance.manga_slug is None and hasattr(obj, "manga") and obj.manga:
            instance.manga_slug = obj.manga.slug
        return instance


class ScraperErrorOut(BaseModel):
    id: int
    manga_id: int
    chapter_url: str
    chapter_number: Optional[str]
    scraper_name: str
    error_message: str
    retry_count: int
    resolved: bool
    first_failed_at: datetime
    last_failed_at: datetime

    model_config = {"from_attributes": True}


class AddMangaScraperRequest(BaseModel):
    manga_url: str
    scraper_name: str
    anilist_id: Optional[int] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
