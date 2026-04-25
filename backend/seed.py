"""
seed.py — Debug all API endpoints and insert 2 dummy manga.
Runs entirely in-process via httpx ASGITransport (no server needed).

Usage:
    cd fast_manga/backend
    python seed.py
"""

import asyncio
import json
import os
import sys

# Make sure `app` is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from decimal import Decimal

import httpx
from app.database import AsyncSessionLocal, create_tables
from app.main import app
from app.models.manga import (
    Category,
    Chapter,
    Manga,
    MangaCategory,
)
from app.models.user import User
from app.utils.helpers import make_slug, slugify_chapter_number
from app.utils.security import hash_password
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
INFO = "\033[94m→\033[0m"


def log(symbol, label, status_code=None, detail=None):
    code_str = f"  HTTP {status_code}" if status_code else ""
    detail_str = f"  {detail}" if detail else ""
    print(f"  {symbol} {label}{code_str}{detail_str}")


def check(label, response, expected=(200, 201, 204)):
    ok = response.status_code in expected
    symbol = PASS if ok else FAIL
    body = ""
    if not ok:
        try:
            body = f"→ {response.json()}"
        except Exception:
            body = f"→ {response.text[:120]}"
    log(symbol, label, response.status_code, body if not ok else None)
    return ok, response


# ── DB seeding (direct, bypass HTTP) ─────────────────────────────────────────


async def seed_db():
    """Insert categories, 2 manga, chapters and a staff user directly into DB."""
    print(f"\n{INFO} Seeding database directly …")

    async with AsyncSessionLocal() as db:
        # ── 1. Categories ────────────────────────────────────────────────────
        category_data = [
            ("Action", "action"),
            ("Adventure", "adventure"),
            ("Fantasy", "fantasy"),
            ("Romance", "romance"),
            ("Comedy", "comedy"),
            ("Shounen", "shounen"),
            ("Drama", "drama"),
            ("Sci-Fi", "sci-fi"),
        ]
        categories = {}
        for name, slug in category_data:
            existing = (
                await db.execute(select(Category).where(Category.slug == slug))
            ).scalar_one_or_none()
            if not existing:
                cat = Category(name=name, slug=slug)
                db.add(cat)
                await db.flush()
                categories[slug] = cat
            else:
                categories[slug] = existing
        print(f"    {PASS} {len(categories)} categories ready")

        # ── 2. Staff / admin user ────────────────────────────────────────────
        admin_username = "admin"
        existing_admin = (
            await db.execute(select(User).where(User.username == admin_username))
        ).scalar_one_or_none()
        if not existing_admin:
            admin = User(
                username=admin_username,
                email="admin@example.com",
                hashed_password=hash_password("admin1234"),
                is_staff=True,
                is_superuser=True,
            )
            db.add(admin)
            await db.flush()
            print(
                f"    {PASS} Staff user created  (username=admin  password=admin1234)"
            )
        else:
            print(f"    {INFO} Staff user already exists")

        # ── 3. Manga 1 — "Blade of the Eternal Storm" ───────────────────────
        slug1 = "blade-of-the-eternal-storm"
        manga1 = (
            await db.execute(select(Manga).where(Manga.slug == slug1))
        ).scalar_one_or_none()
        if not manga1:
            manga1 = Manga(
                title="Blade of the Eternal Storm",
                slug=slug1,
                description=(
                    "In a world where storms grant warriors supernatural power, "
                    "young swordsman Kaito discovers he can absorb lightning itself. "
                    "Hunted by the Empire and chased by rival clans, he must master "
                    "his gift before the next Great Storm destroys everything he loves."
                ),
                author="Hiroshi Tanaka",
                artist="Yuki Mori",
                status="ongoing",
                average_rating=4.7,
                rating_count=1283,
                sources=[
                    {
                        "url": "https://example-scans.com/blade-eternal-storm",
                        "scraper": "default",
                    }
                ],
            )
            db.add(manga1)
            await db.flush()

            # Associate categories
            for slug in ("action", "adventure", "fantasy", "shounen"):
                db.add(
                    MangaCategory(manga_id=manga1.id, category_id=categories[slug].id)
                )
            await db.flush()

            # Chapters (1 – 5) with dummy image URLs
            chapter_objects_1 = []
            for num in range(1, 6):
                d = Decimal(str(num))
                ch = Chapter(
                    manga_id=manga1.id,
                    number=d,
                    title=_chapter_title_1(num),
                    slug=slugify_chapter_number(d),
                    images_data=[
                        f"https://picsum.photos/seed/m1c{num}p{p}/800/1200"
                        for p in range(1, 13)
                    ],
                )
                db.add(ch)
                chapter_objects_1.append(ch)
            await db.flush()

            manga1.first_chapter_id = chapter_objects_1[0].id
            manga1.latest_chapter_id = chapter_objects_1[-1].id
            db.add(manga1)
            print(
                f"    {PASS} Manga 1 created: '{manga1.title}'  ({len(chapter_objects_1)} chapters)"
            )
        else:
            print(f"    {INFO} Manga 1 already exists")

        # ── 4. Manga 2 — "Starfall Academy" ─────────────────────────────────
        slug2 = "starfall-academy"
        manga2 = (
            await db.execute(select(Manga).where(Manga.slug == slug2))
        ).scalar_one_or_none()
        if not manga2:
            manga2 = Manga(
                title="Starfall Academy",
                slug=slug2,
                description=(
                    "When sixteen-year-old Noa receives a letter from the most "
                    "prestigious magic academy in the galaxy, she expects adventure — "
                    "not ancient conspiracies, a grumpy star-dragon roommate, and the "
                    "very real possibility that the academy itself wants her dead."
                ),
                author="Sakura Aizawa",
                artist="Ren Fujita",
                status="ongoing",
                average_rating=4.4,
                rating_count=876,
                sources=[
                    {
                        "url": "https://example-scans.com/starfall-academy",
                        "scraper": "default",
                    }
                ],
            )
            db.add(manga2)
            await db.flush()

            for slug in ("fantasy", "romance", "comedy", "sci-fi"):
                db.add(
                    MangaCategory(manga_id=manga2.id, category_id=categories[slug].id)
                )
            await db.flush()

            chapter_objects_2 = []
            for num in range(1, 8):
                d = Decimal(str(num))
                ch = Chapter(
                    manga_id=manga2.id,
                    number=d,
                    title=_chapter_title_2(num),
                    slug=slugify_chapter_number(d),
                    images_data=[
                        f"https://picsum.photos/seed/m2c{num}p{p}/800/1200"
                        for p in range(1, 16)
                    ],
                )
                db.add(ch)
                chapter_objects_2.append(ch)
            await db.flush()

            manga2.first_chapter_id = chapter_objects_2[0].id
            manga2.latest_chapter_id = chapter_objects_2[-1].id
            db.add(manga2)
            print(
                f"    {PASS} Manga 2 created: '{manga2.title}'  ({len(chapter_objects_2)} chapters)"
            )
        else:
            print(f"    {INFO} Manga 2 already exists")

        await db.commit()
    print(f"    {PASS} DB commit successful\n")


def _chapter_title_1(n):
    titles = {
        1: "The Storm Awakens",
        2: "Lightning in the Blood",
        3: "The Empire Strikes",
        4: "Trial by Thunder",
        5: "Eye of the Tempest",
    }
    return titles.get(n, f"Chapter {n}")


def _chapter_title_2(n):
    titles = {
        1: "Acceptance Letter",
        2: "Arrival at Starfall",
        3: "The Grumpy Dragon",
        4: "First Spell, First Disaster",
        5: "The Forbidden Archive",
        6: "Secrets in the Stars",
        7: "The Academy's Shadow",
    }
    return titles.get(n, f"Chapter {n}")


# ── HTTP endpoint tests ───────────────────────────────────────────────────────


async def run_tests():
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        print("─" * 60)
        print("  ENDPOINT DEBUG SUITE")
        print("─" * 60)

        failures = []

        def chk(label, response, expected=(200, 201, 204, 409)):
            ok, r = check(label, response, expected)
            if not ok:
                failures.append(label)
            return r

        # ── Auth ─────────────────────────────────────────────────────────────
        print("\n  [AUTH]")
        r = chk("Health check", await client.get("/api/health"), (200,))
        r = chk(
            "Register testuser",
            await client.post(
                "/api/auth/register",
                json={
                    "username": "testuser",
                    "email": "tester@example.com",
                    "password": "test1234",
                },
            ),
            (201, 400, 409),
        )
        r = chk(
            "Login testuser",
            await client.post(
                "/api/auth/login", json={"username": "testuser", "password": "test1234"}
            ),
            (200,),
        )
        user_token = r.json().get("access_token", "") if r.status_code == 200 else ""
        user_hdrs = {"Authorization": f"Bearer {user_token}"}

        r = chk(
            "Login admin",
            await client.post(
                "/api/auth/login", json={"username": "admin", "password": "admin1234"}
            ),
            (200,),
        )
        admin_token = r.json().get("access_token", "") if r.status_code == 200 else ""
        admin_hdrs = {"Authorization": f"Bearer {admin_token}"}

        chk(
            "GET /auth/me (user)",
            await client.get("/api/auth/me", headers=user_hdrs),
            (200,),
        )
        chk(
            "GET /auth/me (admin)",
            await client.get("/api/auth/me", headers=admin_hdrs),
            (200,),
        )
        chk("GET /auth/me (no auth)", await client.get("/api/auth/me"), (401,))

        # ── Users ─────────────────────────────────────────────────────────────
        print("\n  [USERS]")
        chk(
            "GET /users/profile",
            await client.get("/api/users/profile", headers=user_hdrs),
            (200,),
        )
        chk(
            "PUT /users/profile (bio)",
            await client.put(
                "/api/users/profile", headers=user_hdrs, json={"bio": "I love manga!"}
            ),
            (200,),
        )
        chk(
            "GET /users/testuser (public)",
            await client.get("/api/users/testuser"),
            (200,),
        )
        chk(
            "GET /users/nobody (404)", await client.get("/api/users/nobody_xyz"), (404,)
        )

        # ── Manga listing ─────────────────────────────────────────────────────
        print("\n  [MANGA — listing & search]")
        chk("GET /manga/ (all)", await client.get("/api/manga/"), (200,))
        chk(
            "GET /manga/ (ongoing)",
            await client.get("/api/manga/", params={"status": "ongoing"}),
            (200,),
        )
        chk(
            "GET /manga/ (sort=rating)",
            await client.get("/api/manga/", params={"sort": "rating"}),
            (200,),
        )
        chk(
            "GET /manga/ (sort=title)",
            await client.get("/api/manga/", params={"sort": "title"}),
            (200,),
        )
        chk(
            "GET /manga/ (category=action)",
            await client.get("/api/manga/", params={"category": "action"}),
            (200,),
        )
        chk("GET /manga/categories", await client.get("/api/manga/categories"), (200,))
        chk(
            "GET /manga/search ?q=blade",
            await client.get("/api/manga/search", params={"q": "blade"}),
            (200,),
        )
        chk(
            "GET /manga/search ?q=star",
            await client.get("/api/manga/search", params={"q": "star"}),
            (200,),
        )
        chk(
            "GET /manga/search ?q=noresult",
            await client.get("/api/manga/search", params={"q": "xyzzy_no_match_999"}),
            (200,),
        )

        # ── Manga detail ──────────────────────────────────────────────────────
        print("\n  [MANGA — detail & chapters]")
        chk(
            "GET /manga/blade-of-the-eternal-storm",
            await client.get("/api/manga/blade-of-the-eternal-storm"),
            (200,),
        )
        chk(
            "GET /manga/starfall-academy",
            await client.get("/api/manga/starfall-academy"),
            (200,),
        )
        chk(
            "GET /manga/does-not-exist (404)",
            await client.get("/api/manga/does-not-exist"),
            (404,),
        )
        chk(
            "GET /manga/blade…/chapters",
            await client.get("/api/manga/blade-of-the-eternal-storm/chapters"),
            (200,),
        )
        chk(
            "GET /manga/starfall…/chapters",
            await client.get("/api/manga/starfall-academy/chapters"),
            (200,),
        )
        chk(
            "GET /manga/blade…/recommendations",
            await client.get("/api/manga/blade-of-the-eternal-storm/recommendations"),
            (200,),
        )

        # ── Chapter reader ────────────────────────────────────────────────────
        print("\n  [CHAPTERS — reader & nav]")
        chk(
            "GET chapter-1 (blade)",
            await client.get("/api/manga/blade-of-the-eternal-storm/chapter/chapter-1"),
            (200,),
        )
        chk(
            "GET chapter-3 (blade)",
            await client.get("/api/manga/blade-of-the-eternal-storm/chapter/chapter-3"),
            (200,),
        )
        chk(
            "GET chapter-1 (starfall)",
            await client.get("/api/manga/starfall-academy/chapter/chapter-1"),
            (200,),
        )
        chk(
            "GET nav chapter-1",
            await client.get(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/nav"
            ),
            (200,),
        )
        chk(
            "GET nav chapter-3",
            await client.get(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-3/nav"
            ),
            (200,),
        )
        chk(
            "POST mark-read ch-1",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/mark-read",
                headers=user_hdrs,
            ),
            (200,),
        )
        chk(
            "POST mark-read ch-1 again (idempotent)",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/mark-read",
                headers=user_hdrs,
            ),
            (200,),
        )

        # ── Comments ──────────────────────────────────────────────────────────
        print("\n  [COMMENTS]")
        chk(
            "POST comment ch-1 (blade)",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/comments",
                headers=user_hdrs,
                json={"text": "Amazing first chapter! Kaito's power is insane 🔥"},
            ),
            (201,),
        )
        chk(
            "POST comment ch-1 (anon)",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/comments",
                json={"text": "Came here from the recommendation. Not disappointed!"},
            ),
            (201,),
        )
        chk(
            "POST comment ch-1 (starfall)",
            await client.post(
                "/api/manga/starfall-academy/chapter/chapter-1/comments",
                headers=user_hdrs,
                json={"text": "Noa is such a great protagonist!"},
            ),
            (201,),
        )
        chk(
            "GET comments ch-1 (blade)",
            await client.get(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/comments"
            ),
            (200,),
        )
        chk(
            "GET comment-count ch-1",
            await client.get(
                "/api/manga/blade-of-the-eternal-storm/chapter/chapter-1/comment-count"
            ),
            (200,),
        )

        # ── Ratings ───────────────────────────────────────────────────────────
        print("\n  [RATINGS]")
        chk(
            "POST rate blade=5",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/rating",
                headers=user_hdrs,
                json={"score": 5},
            ),
            (200,),
        )
        chk(
            "POST rate blade=5 (update)",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/rating",
                headers=user_hdrs,
                json={"score": 4},
            ),
            (200,),
        )
        chk(
            "GET my rating (blade)",
            await client.get(
                "/api/manga/blade-of-the-eternal-storm/rating/me", headers=user_hdrs
            ),
            (200,),
        )
        chk(
            "POST rate starfall=5",
            await client.post(
                "/api/manga/starfall-academy/rating",
                headers=user_hdrs,
                json={"score": 5},
            ),
            (200,),
        )
        chk(
            "POST rate invalid score (422)",
            await client.post(
                "/api/manga/blade-of-the-eternal-storm/rating",
                headers=user_hdrs,
                json={"score": 9},
            ),
            (422,),
        )

        # ── Bookmarks ─────────────────────────────────────────────────────────
        print("\n  [BOOKMARKS]")
        chk(
            "POST bookmark blade",
            await client.post(
                "/api/bookmarks/blade-of-the-eternal-storm", headers=user_hdrs
            ),
            (201,),
        )
        chk(
            "POST bookmark blade (dup→409)",
            await client.post(
                "/api/bookmarks/blade-of-the-eternal-storm", headers=user_hdrs
            ),
            (409,),
        )
        chk(
            "POST bookmark starfall",
            await client.post("/api/bookmarks/starfall-academy", headers=user_hdrs),
            (201,),
        )
        chk(
            "GET bookmarks",
            await client.get("/api/bookmarks/", headers=user_hdrs),
            (200,),
        )
        chk(
            "DELETE bookmark starfall",
            await client.delete("/api/bookmarks/starfall-academy", headers=user_hdrs),
            (204,),
        )
        chk(
            "GET bookmarks (1 left)",
            await client.get("/api/bookmarks/", headers=user_hdrs),
            (200,),
        )

        # ── History ───────────────────────────────────────────────────────────
        print("\n  [HISTORY]")
        chk("GET history", await client.get("/api/history/", headers=user_hdrs), (200,))
        chk(
            "GET read-chapters (blade)",
            await client.get(
                "/api/history/read-chapters", headers=user_hdrs, params={"manga_id": 1}
            ),
            (200,),
        )

        # ── Notifications ─────────────────────────────────────────────────────
        print("\n  [NOTIFICATIONS]")
        chk(
            "GET notifications (empty)",
            await client.get("/api/notifications/", headers=user_hdrs),
            (200,),
        )
        chk(
            "POST mark-all-read",
            await client.post("/api/notifications/read-all", headers=user_hdrs),
            (200,),
        )

        # ── Password change ───────────────────────────────────────────────────
        print("\n  [PASSWORD CHANGE]")
        chk(
            "POST password/change (wrong current)",
            await client.post(
                "/api/auth/password/change",
                headers=user_hdrs,
                json={"current_password": "wrongpass", "new_password": "newpass456"},
            ),
            (400,),
        )
        chk(
            "POST password/change (correct)",
            await client.post(
                "/api/auth/password/change",
                headers=user_hdrs,
                json={"current_password": "test1234", "new_password": "newpass456"},
            ),
            (200,),
        )
        chk(
            "Login with new password",
            await client.post(
                "/api/auth/login",
                json={"username": "testuser", "password": "newpass456"},
            ),
            (200,),
        )

        # ── Staff / Scraper ───────────────────────────────────────────────────
        print("\n  [STAFF / SCRAPER]")
        chk(
            "GET /staff/scrapers/ (user→403)",
            await client.get("/api/staff/scrapers/", headers=user_hdrs),
            (403,),
        )
        chk(
            "GET /staff/scrapers/ (admin)",
            await client.get("/api/staff/scrapers/", headers=admin_hdrs),
            (200,),
        )
        chk(
            "GET /staff/scrapers/errors",
            await client.get("/api/staff/scrapers/errors", headers=admin_hdrs),
            (200,),
        )
        chk(
            "GET /staff/scrapers/1/rows",
            await client.get("/api/staff/scrapers/1/rows", headers=admin_hdrs),
            (200,),
        )

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n" + "─" * 60)
        total = 50  # approximate
        failed = len(failures)
        passed = total - failed
        if failures:
            print(f"  {FAIL}  {failed} test(s) FAILED:")
            for f in failures:
                print(f"       • {f}")
        else:
            print(f"  {PASS}  All endpoint checks passed!")
        print("─" * 60)

        # ── Pretty-print sample responses ─────────────────────────────────────
        print("\n  SAMPLE RESPONSES\n")

        r = await client.get("/api/manga/blade-of-the-eternal-storm")
        data = r.json()
        print("  Manga 1 detail (excerpt):")
        print(f"    title        : {data.get('title')}")
        print(f"    status       : {data.get('status')}")
        print(f"    avg_rating   : {data.get('average_rating')}")
        print(f"    categories   : {[c['name'] for c in data.get('categories', [])]}")
        print(f"    first_chapter: {data.get('first_chapter', {})}")
        print(f"    latest_chap  : {data.get('latest_chapter', {})}")

        r = await client.get("/api/manga/blade-of-the-eternal-storm/chapter/chapter-1")
        data = r.json()
        print("\n  Chapter 1 (blade) excerpt:")
        print(f"    number : {data.get('number')}")
        print(f"    title  : {data.get('title')}")
        print(f"    images : {len(data.get('images_data', []))} pages")
        print(f"    first  : {data.get('images_data', ['—'])[0]}")

        r = await client.get(
            "/api/manga/blade-of-the-eternal-storm/chapter/chapter-3/nav"
        )
        data = r.json()
        print("\n  Chapter 3 nav:")
        print(f"    prev: {data.get('prev')}")
        print(f"    next: {data.get('next')}")

        r = await client.get("/api/manga/search", params={"q": "blade"})
        data = r.json()
        print(f"\n  Search 'blade': {data.get('total')} result(s)")

        r = await client.get("/api/manga/categories")
        cats = r.json()
        print(f"\n  Categories ({len(cats)}): {[c['name'] for c in cats]}")

        print()


# ── Entry point ───────────────────────────────────────────────────────────────


async def main():
    print("\n" + "=" * 60)
    print("  FastManga — Seed & Debug Script")
    print("=" * 60)

    # Step 1: ensure tables exist
    print(f"\n{INFO} Initialising database …")
    await create_tables()
    print(f"  {PASS} Tables ready")

    # Step 2: seed data
    await seed_db()

    # Step 3: run HTTP tests against the live ASGI app
    await run_tests()

    print(f"\n{INFO} Seed credentials summary:")
    print("    Admin  → username: admin       password: admin1234")
    print("    Tester → username: testuser    password: newpass456")
    print()


if __name__ == "__main__":
    asyncio.run(main())
