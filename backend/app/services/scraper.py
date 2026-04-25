"""
Scraper service — pluggable scraper registry.

Two scraper types are supported:
  1. BaseMangaScraper subclass instances (from scrapers/) — full pipeline
  2. Plain async callables (legacy / placeholder) — return-data approach

The SCRAPERS dict is populated by `import scrapers` at app startup.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.manga import ScraperError

logger = logging.getLogger(__name__)


# ── Registry ──────────────────────────────────────────────────────────────────

# Keys: scraper_name string
# Values: BaseMangaScraper instance OR async callable(url) -> dict
SCRAPERS: dict = {}


def register_scraper(name: str):
    """
    Decorator to register a plain async callable scraper.

    @register_scraper("my_site")
    async def my_scraper(url: str) -> dict:
        ...
    """

    def decorator(fn):
        SCRAPERS[name] = fn
        return fn

    return decorator


# ── Helpers ───────────────────────────────────────────────────────────────────


def _is_base_scraper(obj) -> bool:
    """True if obj is a BaseMangaScraper instance."""
    try:
        from scrapers.base_scraper import BaseMangaScraper

        return isinstance(obj, BaseMangaScraper)
    except ImportError:
        return False


# ── Core tasks (called as FastAPI BackgroundTasks) ────────────────────────────


async def run_scraper(
    url: str,
    scraper_name: str,
    manga_id: Optional[int] = None,
    anilist_id: Optional[int] = None,
) -> None:
    """
    Background task: scrape a manga URL and persist chapters.

    Args:
        url:          The manga page URL to scrape
        scraper_name: Key into SCRAPERS registry
        manga_id:     Existing DB manga id (optional)
        anilist_id:   AniList id — creates manga if not in DB (optional)
    """
    scraper = SCRAPERS.get(scraper_name)
    if scraper is None:
        logger.error(
            "No scraper registered for '%s'. Available: %s",
            scraper_name,
            list(SCRAPERS.keys()),
        )
        return

    # ── New-style: BaseMangaScraper ───────────────────────────────────────────
    if _is_base_scraper(scraper):
        try:
            await scraper.scrape_manga_chapters_async(
                manga_page_url=url,
                manga_id=manga_id,
                anilist_id=anilist_id,
            )
        except Exception as exc:
            logger.error(
                "Scraper '%s' raised an exception for %s: %s",
                scraper_name,
                url,
                exc,
                exc_info=True,
            )
        return

    # ── Legacy-style: async callable ─────────────────────────────────────────
    try:
        data = await scraper(url)
    except NotImplementedError:
        logger.error("Scraper '%s' is not yet implemented (placeholder).", scraper_name)
        return
    except Exception as exc:
        logger.error("Legacy scraper '%s' failed for %s: %s", scraper_name, url, exc)
        if manga_id:
            await _record_legacy_error(manga_id, url, scraper_name, str(exc))
        return

    # Persist legacy scraper data
    if manga_id and data:
        from scrapers.utils.storage import save_chapter, update_manga_boundaries

        try:
            for ch in data.get("chapters", []):
                await save_chapter(manga_id, ch["number"], ch.get("images", []))
            await update_manga_boundaries(manga_id)
        except Exception as exc:
            logger.error("Failed to persist legacy scraper data: %s", exc)


async def retry_chapter_error(error_id: int) -> None:
    """
    Background task: retry a single failed chapter from ScraperError table.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScraperError).where(ScraperError.id == error_id)
        )
        err = result.scalar_one_or_none()

    if not err or bool(err.resolved):
        return

    # Extract plain Python scalars — Pyright cannot narrow SQLAlchemy Column types
    err_manga_id: int = err.manga_id  # type: ignore[assignment]
    err_chapter_url: str = err.chapter_url  # type: ignore[assignment]
    err_scraper_name: str = err.scraper_name  # type: ignore[assignment]
    err_chapter_number: str | None = err.chapter_number  # type: ignore[assignment]

    scraper = SCRAPERS.get(err_scraper_name)
    if scraper is None:
        logger.error("No scraper registered for '%s'", err_scraper_name)
        return

    # ── New-style retry ───────────────────────────────────────────────────────
    if _is_base_scraper(scraper):
        import asyncio

        import aiohttp
        from scrapers.utils.storage import mark_error_resolved, record_scraper_error

        async with aiohttp.ClientSession() as session:
            semaphore = asyncio.Semaphore(1)
            result = await scraper.fetch_and_process_chapter(
                session=session,
                chapter_url=err_chapter_url,
                manga_id=err_manga_id,
                semaphore=semaphore,
                chapter_number=err_chapter_number,
            )

        if result:
            await mark_error_resolved(err_manga_id, err_chapter_url)
            logger.info("Retry succeeded for ScraperError #%d", error_id)
        else:
            await record_scraper_error(
                manga_id=err_manga_id,
                chapter_url=err_chapter_url,
                scraper_name=err_scraper_name,
                chapter_number=err_chapter_number,
                error_message="Retry failed",
            )
            logger.warning("Retry failed for ScraperError #%d", error_id)
        return

    # ── Legacy retry ──────────────────────────────────────────────────────────
    try:
        data = await scraper(err_chapter_url)
        chapters = data.get("chapters", [{}])
        if chapters:
            from scrapers.utils.storage import mark_error_resolved, save_chapter

            ch = chapters[0]
            await save_chapter(err_manga_id, ch["number"], ch.get("images", []))
            await mark_error_resolved(err_manga_id, err_chapter_url)
            logger.info("Legacy retry succeeded for error #%d", error_id)
    except Exception as exc:
        from scrapers.utils.storage import record_scraper_error

        await record_scraper_error(
            manga_id=err_manga_id,
            chapter_url=err_chapter_url,
            scraper_name=err_scraper_name,
            chapter_number=err_chapter_number,
            error_message=str(exc),
        )
        logger.error("Legacy retry failed for error #%d: %s", error_id, exc)


async def _record_legacy_error(
    manga_id: int, url: str, scraper_name: str, error_message: str
) -> None:
    from scrapers.utils.storage import record_scraper_error

    await record_scraper_error(manga_id, url, scraper_name, error_message=error_message)
