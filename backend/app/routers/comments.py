from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.manga import Chapter, Comment, Manga
from app.models.user import User
from app.schemas.manga import CommentCreate, CommentOut
from app.services.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/manga", tags=["comments"])


def _chapter_by_slugs_stmt(manga_slug: str, chapter_slug: str):
    """Reusable statement: look up a Chapter by manga slug + chapter slug."""
    return (
        select(Chapter)
        .join(Manga, Manga.id == Chapter.manga_id)
        .where(Manga.slug == manga_slug, Chapter.slug == chapter_slug)
    )


@router.get(
    "/{manga_slug}/chapter/{chapter_slug}/comments",
    response_model=list[CommentOut],
)
async def list_comments(
    manga_slug: str,
    chapter_slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_chapter_by_slugs_stmt(manga_slug, chapter_slug))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    comments_stmt = (
        select(Comment)
        .options(joinedload(Comment.user))
        .where(Comment.chapter_id == chapter.id)
        .order_by(Comment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    comments_result = await db.execute(comments_stmt)
    comments = comments_result.scalars().all()

    return [
        CommentOut(
            id=c.id,
            user_id=c.user_id,
            chapter_id=c.chapter_id,
            text=c.text,
            created_at=c.created_at,
            username=c.user.username if c.user else "Anonymous",
        )
        for c in comments
    ]


@router.get("/{manga_slug}/chapter/{chapter_slug}/comment-count")
async def comment_count(
    manga_slug: str,
    chapter_slug: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Chapter.id)
        .join(Manga, Manga.id == Chapter.manga_id)
        .where(Manga.slug == manga_slug, Chapter.slug == chapter_slug)
    )
    result = await db.execute(stmt)
    chapter_id = result.scalar_one_or_none()
    if not chapter_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    count_result = await db.execute(
        select(func.count()).where(Comment.chapter_id == chapter_id)
    )
    return {"count": count_result.scalar_one()}


@router.post(
    "/{manga_slug}/chapter/{chapter_slug}/comments",
    response_model=CommentOut,
    status_code=201,
)
async def add_comment(
    manga_slug: str,
    chapter_slug: str,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(_chapter_by_slugs_stmt(manga_slug, chapter_slug))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    comment = Comment(
        user_id=current_user.id if current_user else None,
        chapter_id=chapter.id,
        text=payload.text,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut(
        id=comment.id,
        user_id=comment.user_id,
        chapter_id=comment.chapter_id,
        text=comment.text,
        created_at=comment.created_at,
        username=current_user.username if current_user else "Anonymous",
    )
