"""
Scraper admin endpoints — staff only.
Handles: dashboard listing, add manga URL, start scrape, retry errors.
The actual scraping runs as a FastAPI BackgroundTask.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.manga import Chapter, Manga, ScraperError
from app.models.user import User
from app.schemas.manga import AddMangaScraperRequest, ScraperErrorOut
from app.services.auth import get_staff_user
from app.services.scraper import retry_chapter_error, run_scraper

router = APIRouter(prefix="/staff/scrapers", tags=["scraper"])


@router.get("/")
async def scraper_dashboard(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    count_result = await db.execute(select(func.count()).select_from(Manga))
    total = count_result.scalar_one()

    result = await db.execute(
        select(Manga)
        .options(joinedload(Manga.latest_chapter))
        .order_by(Manga.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    mangas = result.scalars().unique().all()

    return {
        "items": [
            {
                "id": m.id,
                "title": m.title,
                "slug": m.slug,
                "status": m.status,
                "updated_at": m.updated_at,
                "latest_chapter": {
                    "number": m.latest_chapter.number,
                    "slug": m.latest_chapter.slug,
                }
                if m.latest_chapter
                else None,
            }
            for m in mangas
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/add")
async def add_manga(
    payload: AddMangaScraperRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    background_tasks.add_task(
        run_scraper,
        payload.manga_url,
        payload.scraper_name,
        None,
        payload.anilist_id,
    )
    return {"detail": f"Scrape task queued for {payload.manga_url}"}


@router.post("/start/{manga_id}")
async def start_scrape(
    manga_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    result = await db.execute(select(Manga).where(Manga.id == manga_id))
    manga = result.scalar_one_or_none()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")

    sources = manga.sources or []
    if not sources:
        raise HTTPException(status_code=400, detail="Manga has no sources configured")

    # Determine a fallback scraper name (first registered, skip "default")
    from app.services.scraper import SCRAPERS

    fallback_scraper = next((k for k in SCRAPERS if k != "default"), "mangabuddy")

    for source in sources:
        if isinstance(source, dict):
            url = source.get("url", "")
            scraper_name = source.get("scraper") or fallback_scraper
        else:
            url = source
            scraper_name = fallback_scraper

        # Skip if scraper is "default" (old placeholder) and replace with fallback
        if scraper_name == "default":
            scraper_name = fallback_scraper

        if not url:
            continue
        background_tasks.add_task(run_scraper, url, scraper_name, manga_id)

    return {"detail": f"Scrape task started for manga #{manga_id}"}


@router.post("/retry/{manga_id}")
async def retry_errors(
    manga_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    result = await db.execute(
        select(ScraperError).where(
            ScraperError.manga_id == manga_id, ScraperError.resolved == False
        )
    )
    errors = result.scalars().all()
    if not errors:
        return {"detail": "No unresolved errors found"}

    for err in errors:
        background_tasks.add_task(retry_chapter_error, err.id)

    return {"detail": f"Queued {len(errors)} retry tasks"}


@router.get("/errors", response_model=list[ScraperErrorOut])
async def list_errors(
    resolved: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    result = await db.execute(
        select(ScraperError)
        .where(ScraperError.resolved == resolved)
        .order_by(ScraperError.last_failed_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.get("/{manga_id}/rows")
async def manga_rows(
    manga_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    chapters_result = await db.execute(
        select(Chapter)
        .where(Chapter.manga_id == manga_id)
        .order_by(Chapter.number.desc())
    )
    chapters = chapters_result.scalars().all()

    errors_result = await db.execute(
        select(ScraperError).where(
            ScraperError.manga_id == manga_id, ScraperError.resolved == False
        )
    )
    errors = errors_result.scalars().all()

    return {
        "chapters": [
            {
                "id": c.id,
                "number": c.number,
                "title": c.title,
                "slug": c.slug,
                "image_count": len(c.images_data),
            }
            for c in chapters
        ],
        "errors": [
            {
                "id": e.id,
                "chapter_url": e.chapter_url,
                "error_message": e.error_message,
                "retry_count": e.retry_count,
            }
            for e in errors
        ],
    }
