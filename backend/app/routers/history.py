from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.manga import Chapter, ChapterReadProgress, ReadingHistory
from app.models.user import User
from app.schemas.manga import ReadingHistoryOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/", response_model=list[ReadingHistoryOut])
async def reading_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # prefetch manga
    result = await db.execute(
        select(ReadingHistory)
        .options(joinedload(ReadingHistory.manga))
        .where(ReadingHistory.user_id == current_user.id)
        .order_by(ReadingHistory.last_read_at.desc())
        .limit(50)
    )
    history = result.scalars().all()
    return [
        {
            "id": item.id,
            "manga_id": item.manga_id,
            "manga_title": item.manga.title if item.manga else None,
            "manga_slug": item.manga.slug if item.manga else None,
            "last_read_chapter_id": item.last_read_chapter_id,
            "last_read_at": item.last_read_at,
        }
        for item in history
    ]


@router.get("/read-chapters")
async def read_chapters(
    manga_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return IDs of chapters the user has read for a given manga."""
    result = await db.execute(
        select(ChapterReadProgress.chapter_id)
        .join(Chapter)
        .where(
            ChapterReadProgress.user_id == current_user.id,
            Chapter.manga_id == manga_id,
        )
    )
    return {"read_chapter_ids": [r for r in result.scalars().all()]}
