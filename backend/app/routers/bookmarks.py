from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.manga import Bookmark, Manga
from app.models.user import User
from app.schemas.manga import BookmarkOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("/", response_model=list[BookmarkOut])
async def my_bookmarks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark)
        .options(joinedload(Bookmark.manga))
        .where(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
    )
    bookmarks = result.scalars().all()
    return [
        BookmarkOut(
            id=bm.id,
            manga_id=bm.manga_id,
            manga_title=bm.manga.title if bm.manga else None,
            manga_slug=bm.manga.slug if bm.manga else None,
            manga_cover_image=bm.manga.cover_image if bm.manga else None,
            created_at=bm.created_at,
        )
        for bm in bookmarks
    ]


@router.post("/{manga_slug}", response_model=BookmarkOut, status_code=201)
async def add_bookmark(
    manga_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    manga_result = await db.execute(select(Manga.id).where(Manga.slug == manga_slug))
    manga_id = manga_result.scalar_one_or_none()
    if not manga_id:
        raise HTTPException(status_code=404, detail="Manga not found")

    existing = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id, Bookmark.manga_id == manga_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already bookmarked")

    bm = Bookmark(user_id=current_user.id, manga_id=manga_id)
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return bm


@router.delete("/{manga_slug}", status_code=204)
async def remove_bookmark(
    manga_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    manga_result = await db.execute(select(Manga.id).where(Manga.slug == manga_slug))
    manga_id = manga_result.scalar_one_or_none()
    if not manga_id:
        raise HTTPException(status_code=404, detail="Manga not found")

    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == current_user.id, Bookmark.manga_id == manga_id
        )
    )
    bm = result.scalar_one_or_none()
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    await db.delete(bm)
    await db.commit()
