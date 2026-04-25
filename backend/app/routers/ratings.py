from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.manga import Manga, Rating
from app.models.user import User
from app.schemas.manga import RatingCreate, RatingOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/manga", tags=["ratings"])


@router.post("/{manga_slug}/rating", response_model=RatingOut)
async def rate_manga(
    manga_slug: str,
    payload: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (1 <= payload.score <= 5):
        raise HTTPException(status_code=422, detail="Score must be 1–5")

    manga_result = await db.execute(select(Manga).where(Manga.slug == manga_slug))
    manga = manga_result.scalar_one_or_none()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")

    existing = await db.execute(
        select(Rating).where(
            Rating.user_id == current_user.id, Rating.manga_id == manga.id
        )
    )
    rating = existing.scalar_one_or_none()
    if rating:
        rating.score = payload.score
    else:
        rating = Rating(user_id=current_user.id, manga_id=manga.id, score=payload.score)
        db.add(rating)

    await db.flush()

    # Recalculate denormalised average
    agg = await db.execute(
        select(func.avg(Rating.score), func.count(Rating.id)).where(
            Rating.manga_id == manga.id
        )
    )
    avg_score, count = agg.one()
    manga.average_rating = round(float(avg_score or 0), 2)
    manga.rating_count = count or 0
    db.add(manga)
    await db.commit()
    await db.refresh(rating)
    return rating


@router.get("/{manga_slug}/rating/me")
async def my_rating(
    manga_slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    manga_result = await db.execute(select(Manga.id).where(Manga.slug == manga_slug))
    manga_id = manga_result.scalar_one_or_none()
    if not manga_id:
        raise HTTPException(status_code=404, detail="Manga not found")

    result = await db.execute(
        select(Rating).where(
            Rating.user_id == current_user.id, Rating.manga_id == manga_id
        )
    )
    rating = result.scalar_one_or_none()
    return {"score": rating.score if rating else None}
