from .anilist import get_manga_info
from .storage import (
    download_cover,
    get_or_create_manga,
    get_unresolved_errors,
    mark_error_resolved,
    record_scraper_error,
    save_chapter,
    update_manga_boundaries,
)
from .structs import MangaInfo

__all__ = [
    "MangaInfo",
    "get_manga_info",
    "get_or_create_manga",
    "save_chapter",
    "update_manga_boundaries",
    "record_scraper_error",
    "mark_error_resolved",
    "get_unresolved_errors",
    "download_cover",
]
