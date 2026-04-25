from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.manga import Chapter, ChapterReadProgress, Manga, ReadingHistory
from app.models.user import User
from app.schemas.manga import ChapterOut
from app.services.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/manga", tags=["chapters"])


@router.get("/{manga_slug}/chapter/{chapter_slug}", response_model=ChapterOut)
async def read_chapter(
    manga_slug: str,
    chapter_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    stmt = (
        select(Chapter)
        .join(Manga, Manga.id == Chapter.manga_id)
        .where(Manga.slug == manga_slug, Chapter.slug == chapter_slug)
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if current_user:
        history_result = await db.execute(
            select(ReadingHistory).where(
                ReadingHistory.user_id == current_user.id,
                ReadingHistory.manga_id == chapter.manga_id,
            )
        )
        rh = history_result.scalar_one_or_none()
        if rh:
            rh.last_read_chapter_id = chapter.id
            db.add(rh)
        else:
            db.add(
                ReadingHistory(
                    user_id=current_user.id,
                    manga_id=chapter.manga_id,
                    last_read_chapter_id=chapter.id,
                )
            )
        await db.commit()

    return chapter


@router.post("/{manga_slug}/chapter/{chapter_slug}/mark-read")
async def mark_chapter_read(
    manga_slug: str,
    chapter_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Chapter)
        .join(Manga, Manga.id == Chapter.manga_id)
        .where(Manga.slug == manga_slug, Chapter.slug == chapter_slug)
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    existing = await db.execute(
        select(ChapterReadProgress).where(
            ChapterReadProgress.user_id == current_user.id,
            ChapterReadProgress.chapter_id == chapter.id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(ChapterReadProgress(user_id=current_user.id, chapter_id=chapter.id))
        await db.commit()

    return {"detail": "Marked as read", "chapter_id": chapter.id}


@router.get("/{manga_slug}/chapter/{chapter_slug}/nav")
async def chapter_navigation(
    manga_slug: str,
    chapter_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Return prev / next chapter slugs for reader navigation."""
    stmt = (
        select(Chapter)
        .join(Manga, Manga.id == Chapter.manga_id)
        .where(Manga.slug == manga_slug, Chapter.slug == chapter_slug)
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    prev_stmt = (
        select(Chapter)
        .where(
            Chapter.manga_id == chapter.manga_id,
            Chapter.number < chapter.number,
        )
        .order_by(Chapter.number.desc())
        .limit(1)
    )
    next_stmt = (
        select(Chapter)
        .where(
            Chapter.manga_id == chapter.manga_id,
            Chapter.number > chapter.number,
        )
        .order_by(Chapter.number.asc())
        .limit(1)
    )
    prev_ch = (await db.execute(prev_stmt)).scalar_one_or_none()
    next_ch = (await db.execute(next_stmt)).scalar_one_or_none()

    return {
        "prev": {"slug": prev_ch.slug, "number": str(prev_ch.number)}
        if prev_ch
        else None,
        "next": {"slug": next_ch.slug, "number": str(next_ch.number)}
        if next_ch
        else None,
    }
