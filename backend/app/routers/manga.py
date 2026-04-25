import os
import uuid
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.config import get_settings
from app.database import get_db
from app.models.manga import Category, Chapter, Manga, MangaCategory
from app.models.user import User
from app.schemas.manga import (
    CategoryOut,
    MangaCreate,
    MangaDetail,
    MangaListItem,
    PaginatedResponse,
)
from app.services.auth import get_current_user, get_optional_user
from app.utils.helpers import make_slug

router = APIRouter(prefix="/manga", tags=["manga"])
settings = get_settings()


def _chapter_to_list_item(ch):
    if ch is None:
        return None
    return {
        "id": ch.id,
        "number": ch.number,
        "title": ch.title,
        "slug": ch.slug,
        "created_at": ch.created_at,
    }


async def _enrich_manga_detail(manga: Manga) -> dict:
    data = {
        "id": manga.id,
        "title": manga.title,
        "slug": manga.slug,
        "description": manga.description,
        "cover_image": manga.cover_image,
        "author": manga.author,
        "artist": manga.artist,
        "status": manga.status,
        "average_rating": manga.average_rating,
        "rating_count": manga.rating_count,
        "anilist_id": manga.anilist_id,
        "sources": manga.sources or [],
        "created_at": manga.created_at,
        "updated_at": manga.updated_at,
        "categories": [
            {"id": mc.category.id, "name": mc.category.name, "slug": mc.category.slug}
            for mc in manga.manga_categories
        ],
        "first_chapter": _chapter_to_list_item(manga.first_chapter),
        "latest_chapter": _chapter_to_list_item(manga.latest_chapter),
    }
    return data


# ── Listing & Search ──────────────────────────────────────────────────────────


@router.get("/", response_model=PaginatedResponse)
async def list_manga(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sort: str = Query("updated_at"),  # updated_at | title | rating
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Manga).options(
        selectinload(Manga.manga_categories).selectinload(MangaCategory.category),
        joinedload(Manga.latest_chapter),
    )
    if status:
        stmt = stmt.where(Manga.status == status)
    if category:
        stmt = stmt.join(MangaCategory).join(Category).where(Category.slug == category)

    if sort == "title":
        stmt = stmt.order_by(Manga.title.asc())
    elif sort == "rating":
        stmt = stmt.order_by(Manga.average_rating.desc())
    else:
        stmt = stmt.order_by(Manga.updated_at.desc())

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    mangas = result.scalars().unique().all()

    items = []
    for m in mangas:
        items.append(
            {
                "id": m.id,
                "title": m.title,
                "slug": m.slug,
                "cover_image": m.cover_image,
                "status": m.status,
                "average_rating": m.average_rating,
                "rating_count": m.rating_count,
                "updated_at": m.updated_at,
                "latest_chapter": _chapter_to_list_item(m.latest_chapter),
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/search", response_model=PaginatedResponse)
async def search_manga(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    stmt = (
        select(Manga)
        .options(joinedload(Manga.latest_chapter))
        .where(or_(Manga.title.ilike(pattern), Manga.author.ilike(pattern)))
        .order_by(Manga.updated_at.desc())
    )
    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    mangas = result.scalars().unique().all()

    items = [
        {
            "id": m.id,
            "title": m.title,
            "slug": m.slug,
            "cover_image": m.cover_image,
            "status": m.status,
            "average_rating": m.average_rating,
            "rating_count": m.rating_count,
            "updated_at": m.updated_at,
            "latest_chapter": _chapter_to_list_item(m.latest_chapter),
        }
        for m in mangas
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


# ── Manga Detail ──────────────────────────────────────────────────────────────


@router.get("/{slug}", response_model=MangaDetail)
async def manga_detail(slug: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Manga)
        .options(
            selectinload(Manga.manga_categories).selectinload(MangaCategory.category),
            joinedload(Manga.first_chapter),
            joinedload(Manga.latest_chapter),
        )
        .where(Manga.slug == slug)
    )
    result = await db.execute(stmt)
    manga = result.scalar_one_or_none()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
    return await _enrich_manga_detail(manga)


@router.get("/{slug}/chapters")
async def manga_chapters(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    manga_result = await db.execute(select(Manga.id).where(Manga.slug == slug))
    manga_id = manga_result.scalar_one_or_none()
    if not manga_id:
        raise HTTPException(status_code=404, detail="Manga not found")

    count_result = await db.execute(
        select(func.count()).where(Chapter.manga_id == manga_id)
    )
    total = count_result.scalar_one()

    ch_result = await db.execute(
        select(Chapter)
        .where(Chapter.manga_id == manga_id)
        .order_by(Chapter.number.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    chapters = ch_result.scalars().all()
    return {
        "items": [
            {
                "id": c.id,
                "number": c.number,
                "title": c.title,
                "slug": c.slug,
                "created_at": c.created_at,
            }
            for c in chapters
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# ── Recommendations ───────────────────────────────────────────────────────────


@router.get("/{slug}/recommendations")
async def recommendations(
    slug: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    # Get current manga categories
    manga_result = await db.execute(
        select(Manga)
        .options(selectinload(Manga.manga_categories))
        .where(Manga.slug == slug)
    )
    manga = manga_result.scalar_one_or_none()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")

    cat_ids = [mc.category_id for mc in manga.manga_categories]
    if not cat_ids:
        # fallback: return latest updated
        stmt = (
            select(Manga)
            .where(Manga.id != manga.id)
            .order_by(Manga.updated_at.desc())
            .limit(limit)
        )
    else:
        stmt = (
            select(Manga)
            .join(MangaCategory)
            .where(MangaCategory.category_id.in_(cat_ids), Manga.id != manga.id)
            .order_by(Manga.average_rating.desc())
            .limit(limit)
        )
    result = await db.execute(stmt)
    recs = result.scalars().unique().all()
    return [
        {
            "id": m.id,
            "title": m.title,
            "slug": m.slug,
            "cover_image": m.cover_image,
            "status": m.status,
        }
        for m in recs
    ]


# ── Admin: Create Manga ───────────────────────────────────────────────────────


@router.post("/", status_code=201)
async def create_manga(
    payload: MangaCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_staff:
        raise HTTPException(status_code=403, detail="Staff only")

    slug = make_slug(payload.title)
    # ensure unique slug
    existing = await db.execute(select(Manga).where(Manga.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    manga = Manga(
        title=payload.title,
        slug=slug,
        description=payload.description,
        author=payload.author,
        artist=payload.artist,
        status=payload.status,
        anilist_id=payload.anilist_id,
        sources=payload.sources,
    )
    db.add(manga)
    await db.flush()

    for cat_id in payload.category_ids:
        db.add(MangaCategory(manga_id=manga.id, category_id=cat_id))

    await db.commit()
    await db.refresh(manga)
    return {"id": manga.id, "slug": manga.slug, "title": manga.title}


@router.post("/{manga_id}/cover")
async def upload_cover(
    manga_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_staff:
        raise HTTPException(status_code=403, detail="Staff only")
    result = await db.execute(select(Manga).where(Manga.id == manga_id))
    manga = result.scalar_one_or_none()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    save_dir = os.path.join(settings.media_dir, "covers")
    os.makedirs(save_dir, exist_ok=True)
    async with aiofiles.open(os.path.join(save_dir, filename), "wb") as f:
        await f.write(await file.read())

    manga.cover_image = f"/media/covers/{filename}"
    db.add(manga)
    await db.commit()
    return {"cover_image": manga.cover_image}
