import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import create_tables
from app.routers import (
    auth,
    bookmarks,
    chapters,
    comments,
    history,
    manga,
    notifications,
    ratings,
    scraper,
    users,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

# ── Scraper registration ───────────────────────────────────────────────────────
# Importing the scrapers package populates app.services.scraper.SCRAPERS
# with all BaseMangaScraper instances (mangabuddy, manhuafast, toonclash, weebcentral).
try:
    import scrapers  # noqa: F401 — side-effect import, triggers __init__.py
except Exception as _scraper_import_err:
    logger.warning("Could not import scrapers package: %s", _scraper_import_err)

# Absolute path to the React build output
_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
FRONTEND_DIST = os.path.normpath(os.path.join(_HERE, "..", "frontend", "dist"))
FRONTEND_INDEX = os.path.join(FRONTEND_DIST, "index.html")
SERVING_FRONTEND = os.path.isfile(FRONTEND_INDEX)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Starting up — creating database tables...")
    await create_tables()
    logger.info("Database ready.")

    # Log registered scrapers so it's visible in the startup log
    try:
        from app.services.scraper import SCRAPERS

        if SCRAPERS:
            logger.info("Registered scrapers: %s", ", ".join(SCRAPERS.keys()))
        else:
            logger.warning("No scrapers registered — check scrapers/__init__.py")
    except Exception:
        pass

    os.makedirs(os.path.join(settings.media_dir, "covers"), exist_ok=True)
    os.makedirs(os.path.join(settings.media_dir, "avatars"), exist_ok=True)

    if SERVING_FRONTEND:
        logger.info("Serving React frontend from: %s", FRONTEND_DIST)
    else:
        logger.info(
            "No frontend build found at %s — redirecting / to /api/docs",
            FRONTEND_DIST,
        )

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Shutting down...")


app = FastAPI(
    title="FastManga API",
    description="A manga reader API built with FastAPI + SQLite",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Media files (user uploads) ────────────────────────────────────────────────
os.makedirs(settings.media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

# ── API Routers ───────────────────────────────────────────────────────────────
API_PREFIX = "/api"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(manga.router, prefix=API_PREFIX)
app.include_router(chapters.router, prefix=API_PREFIX)
app.include_router(bookmarks.router, prefix=API_PREFIX)
app.include_router(ratings.router, prefix=API_PREFIX)
app.include_router(comments.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(history.router, prefix=API_PREFIX)
app.include_router(scraper.router, prefix=API_PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


# ── Frontend serving ──────────────────────────────────────────────────────────
if SERVING_FRONTEND:
    # Serve compiled static assets (JS / CSS / images bundled by Vite)
    _assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="frontend-assets")

    # Serve any other static file that Vite emits at the dist root
    # (favicon.svg, robots.txt, etc.) before falling back to index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """
        SPA catch-all:
        1. If the requested path matches a real file in dist/, serve it directly.
        2. Otherwise return index.html so React Router handles the route.
        """
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_INDEX)

else:
    # ── Dev mode: no built frontend — helpful redirects ───────────────────────
    @app.get("/", include_in_schema=False)
    async def root_redirect():
        """Redirect bare root to the interactive API docs."""
        return RedirectResponse(url="/api/docs")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def catch_all(full_path: str):
        """
        In dev the React dev server (Vite on :5173) handles all frontend
        routes.  Any non-API path that reaches the backend gets a friendly
        JSON explanation instead of a bare 404.
        """
        return {
            "detail": (
                f"Route '/{full_path}' is not a backend API endpoint. "
                "Frontend is served by Vite on http://localhost:5173  |  "
                "API docs: http://localhost:8000/api/docs"
            )
        }
