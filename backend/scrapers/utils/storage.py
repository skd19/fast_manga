"""
Async SQLAlchemy storage helpers for the scraper layer.
No Django dependencies.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import httpx
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.manga import (
    Category,
    Chapter,
    Manga,
    MangaCategory,
    ScraperError,
)
from app.utils.helpers import make_slug, slugify_chapter_number
from sqlalchemy import func, select

from .structs import MangaInfo

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Cover image ───────────────────────────────────────────────────────────────


async def download_cover(image_url: str, title: str) -> str:
    """
    Download a cover image from `image_url`, save it to media/covers/,
    and return the relative URL path (e.g. '/media/covers/abc123.jpg').
    Returns empty string on failure.
    """
    if not image_url:
        return ""
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            content = resp.content
            content_type = resp.headers.get("content-type", "image/jpeg")

        ext = "jpg"
        if "png" in content_type:
            ext = "png"
        elif "webp" in content_type:
            ext = "webp"
        elif "gif" in content_type:
            ext = "gif"

        filename = f"{uuid.uuid4().hex}.{ext}"
        save_dir = os.path.join(settings.media_dir, "covers")
        os.makedirs(save_dir, exist_ok=True)
        filepath = os.path.join(save_dir, filename)

        with open(filepath, "wb") as f:
            f.write(content)

        logger.info("Saved cover image: %s", filepath)
        return f"/media/covers/{filename}"

    except Exception as exc:
        logger.error("Failed to download cover image %s: %s", image_url, exc)
        return ""


# ── Manga helpers ─────────────────────────────────────────────────────────────


async def get_or_create_manga(
    manga_id: Optional[int] = None,
    anilist_id: Optional[int] = None,
    manga_url: Optional[str] = None,
) -> Optional[int]:
    """
    Return the database primary-key of the manga.

    Resolution order:
    1. `manga_id`   — look up directly
    2. `anilist_id` — look up by anilist_id; create from AniList API if missing
    3. raise ValueError if neither provided

    Always appends `manga_url` to sources if given.
    """
    async with AsyncSessionLocal() as db:
        manga: Optional[Manga] = None

        # ── 1. Look up by DB primary key ─────────────────────────────────────
        if manga_id:
            manga = (
                await db.execute(select(Manga).where(Manga.id == manga_id))
            ).scalar_one_or_none()
            if not manga:
                logger.warning("Manga id=%s not found in DB", manga_id)
                if not anilist_id:
                    raise ValueError(
                        f"Manga id={manga_id} not found and no anilist_id given"
                    )

        # ── 2. Look up / create by AniList ID ────────────────────────────────
        if not manga and anilist_id:
            manga = (
                await db.execute(select(Manga).where(Manga.anilist_id == anilist_id))
            ).scalar_one_or_none()

            if not manga:
                # Fetch from AniList and create
                from .anilist import get_manga_info

                info = await get_manga_info(anilist_id)

                if not info.title:
                    raise ValueError(f"AniList returned no title for id={anilist_id}")

                cover_path = await download_cover(info.image, info.title)
                slug = make_slug(info.title)

                # Ensure slug uniqueness
                existing_slug = (
                    await db.execute(select(Manga).where(Manga.slug == slug))
                ).scalar_one_or_none()
                if existing_slug:
                    slug = f"{slug}-{uuid.uuid4().hex[:6]}"

                manga = Manga(
                    title=info.title,
                    slug=slug,
                    description=info.clean_description,
                    cover_image=cover_path or None,
                    author=info.author,
                    status=info.get_status,
                    anilist_id=anilist_id,
                )
                db.add(manga)
                await db.flush()

                # Categories
                for genre_name in info.genres:
                    genre_slug = make_slug(genre_name)
                    cat = (
                        await db.execute(
                            select(Category).where(Category.slug == genre_slug)
                        )
                    ).scalar_one_or_none()
                    if not cat:
                        cat = Category(name=genre_name, slug=genre_slug)
                        db.add(cat)
                        await db.flush()
                    db.add(MangaCategory(manga_id=manga.id, category_id=cat.id))

                await db.commit()
                await db.refresh(manga)
                logger.info("Created manga '%s' (id=%s)", manga.title, manga.id)

        if not manga:
            raise ValueError("Either manga_id or anilist_id must be provided")

        # ── 3. Update sources list ────────────────────────────────────────────
        if manga_url:
            sources = list(manga.sources or [])
            existing_urls = [
                s.get("url") if isinstance(s, dict) else s for s in sources
            ]
            if manga_url not in existing_urls:
                sources.append(manga_url)
                manga.sources = sources
                db.add(manga)
                await db.commit()

        return manga.id


async def update_manga_boundaries(manga_id: int) -> None:
    """Update first_chapter_id / latest_chapter_id and updated_at on the manga."""
    async with AsyncSessionLocal() as db:
        first = (
            await db.execute(
                select(Chapter)
                .where(Chapter.manga_id == manga_id)
                .order_by(Chapter.number.asc())
                .limit(1)
            )
        ).scalar_one_or_none()

        last = (
            await db.execute(
                select(Chapter)
                .where(Chapter.manga_id == manga_id)
                .order_by(Chapter.number.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        manga = (
            await db.execute(select(Manga).where(Manga.id == manga_id))
        ).scalar_one_or_none()

        if manga:
            manga.first_chapter_id = first.id if first else None
            manga.latest_chapter_id = last.id if last else None
            manga.updated_at = datetime.now(timezone.utc)
            db.add(manga)
            await db.commit()


# ── Chapter helpers ───────────────────────────────────────────────────────────


async def save_chapter(
    manga_id: int,
    number: str | Decimal,
    images_data: list[str],
    title: str = "",
) -> None:
    """Upsert a chapter row. Creates it if not exists, updates images if it does."""
    async with AsyncSessionLocal() as db:
        num = Decimal(str(number))
        existing = (
            await db.execute(
                select(Chapter).where(
                    Chapter.manga_id == manga_id,
                    Chapter.number == num,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.images_data = images_data
            if title and not existing.title:
                existing.title = title
        else:
            chapter = Chapter(
                manga_id=manga_id,
                number=num,
                title=title,
                slug=slugify_chapter_number(num),
                images_data=images_data,
            )
            db.add(chapter)

        await db.commit()
        logger.debug(
            "Saved chapter %s for manga_id=%s (%d images)",
            num,
            manga_id,
            len(images_data),
        )


# ── Error tracking ────────────────────────────────────────────────────────────


async def record_scraper_error(
    manga_id: int,
    chapter_url: str,
    scraper_name: str,
    chapter_number: Optional[str] = None,
    error_message: str = "",
) -> None:
    """Create or increment a ScraperError row."""
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(
                select(ScraperError).where(
                    ScraperError.manga_id == manga_id,
                    ScraperError.chapter_url == chapter_url,
                )
            )
        ).scalar_one_or_none()

        if existing:
            existing.retry_count += 1
            existing.error_message = error_message
            existing.resolved = False
            existing.last_failed_at = datetime.now(timezone.utc)
        else:
            db.add(
                ScraperError(
                    manga_id=manga_id,
                    chapter_url=chapter_url,
                    chapter_number=chapter_number or "",
                    scraper_name=scraper_name,
                    error_message=error_message,
                )
            )
        await db.commit()


async def mark_error_resolved(manga_id: int, chapter_url: str) -> None:
    """Mark a ScraperError as resolved."""
    async with AsyncSessionLocal() as db:
        err = (
            await db.execute(
                select(ScraperError).where(
                    ScraperError.manga_id == manga_id,
                    ScraperError.chapter_url == chapter_url,
                )
            )
        ).scalar_one_or_none()

        if err:
            err.resolved = True
            db.add(err)
            await db.commit()


async def get_unresolved_errors(
    manga_id: int,
    scraper_name: str,
) -> list[tuple[str, str]]:
    """Return list of (chapter_url, chapter_number) for unresolved errors."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScraperError.chapter_url, ScraperError.chapter_number).where(
                ScraperError.manga_id == manga_id,
                ScraperError.scraper_name == scraper_name,
                ScraperError.resolved == False,
            )
        )
        return [(row.chapter_url, row.chapter_number or "") for row in result.all()]
