# FastManga 🎌

A full-stack manga reader site built with **FastAPI + SQLite** (backend) and **React + Vite + TailwindCSS** (frontend). Migrated from a Django-based architecture.

---

## 📁 Project Structure

```
fast_manga/
├── .venv/                        # Python virtual environment
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── config.py             # Settings (pydantic-settings + .env)
│   │   ├── database.py           # Async SQLAlchemy engine & session
│   │   ├── models/
│   │   │   ├── user.py           # User model
│   │   │   └── manga.py          # Manga, Chapter, Category, etc.
│   │   ├── schemas/
│   │   │   ├── auth.py           # Auth request/response schemas
│   │   │   ├── user.py           # User schemas
│   │   │   └── manga.py          # Manga/Chapter/Comment schemas
│   │   ├── routers/
│   │   │   ├── auth.py           # /api/auth/* — register, login, password
│   │   │   ├── users.py          # /api/users/* — profile management
│   │   │   ├── manga.py          # /api/manga/* — listing, search, detail
│   │   │   ├── chapters.py       # /api/manga/.../chapter/... — reader
│   │   │   ├── bookmarks.py      # /api/bookmarks/*
│   │   │   ├── ratings.py        # /api/manga/.../rating
│   │   │   ├── comments.py       # /api/manga/.../comments
│   │   │   ├── notifications.py  # /api/notifications/*
│   │   │   ├── history.py        # /api/history/*
│   │   │   └── scraper.py        # /api/staff/scrapers/* (staff only)
│   │   ├── services/
│   │   │   ├── auth.py           # JWT dependency helpers
│   │   │   └── scraper.py        # Scraper engine + registry
│   │   └── utils/
│   │       ├── security.py       # bcrypt + JWT helpers
│   │       └── helpers.py        # Slug utilities
│   ├── alembic/                  # Database migrations
│   ├── media/                    # Uploaded covers & avatars
│   │   ├── covers/
│   │   └── avatars/
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env                      # Environment variables
└── frontend/                     # React + Vite frontend
    ├── src/
    │   ├── api/
    │   │   ├── client.js         # Axios instance w/ JWT interceptors
    │   │   ├── auth.js           # Auth API calls
    │   │   └── manga.js          # All other API calls
    │   ├── components/
    │   │   ├── layout/           # Navbar, Footer, Layout
    │   │   ├── manga/            # ChapterList, MangaReader
    │   │   └── common/           # MangaCard, Pagination, StarRating, etc.
    │   ├── context/
    │   │   └── AuthContext.jsx   # Global auth state
    │   ├── hooks/
    │   │   └── useManga.js       # React Query hooks
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── BrowsePage.jsx
    │   │   ├── SearchPage.jsx
    │   │   ├── MangaDetailPage.jsx
    │   │   ├── ChapterReadPage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   ├── PublicProfilePage.jsx
    │   │   ├── BookmarksPage.jsx
    │   │   ├── NotFoundPage.jsx
    │   │   └── admin/
    │   │       └── ScraperDashboard.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI 0.115 |
| Database | SQLite (via `aiosqlite`) |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Validation | Pydantic v2 |
| Frontend | React 19 + Vite 8 |
| Routing | React Router v6 |
| State / Data | TanStack React Query v5 |
| HTTP client | Axios |
| Styling | TailwindCSS v3 |
| Icons | Lucide React |
| Toasts | react-hot-toast |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm

---

### 1. Clone / Navigate to project

```bash
cd fast_manga
```

---

### 2. Backend Setup

```bash
# Activate the virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Enter backend project
cd backend
```

**Edit `backend/.env`:**

```env
SECRET_KEY=your-super-secret-key-change-in-production-at-least-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite+aiosqlite:///./manga.db
MEDIA_DIR=media
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
AUTO_CREATE_TABLES=false
```

> ⚠️ **Change `SECRET_KEY` before deploying to production!**

### 3. Database Migrations (Alembic)

Apply the schema before starting the backend:

```bash
# From the backend/ directory
alembic upgrade head
```

Create a new migration after changing SQLAlchemy models:

```bash
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

Check current migration status:

```bash
alembic current
alembic history
```

If you already have an existing local database that was created before Alembic was set up, either:

```bash
# Option 1: rebuild local dev DB
del manga.db
alembic upgrade head
```

or mark it as already matching the initial migration:

```bash
# Option 2: keep the existing DB and mark it as migrated
alembic stamp head
```

**Run the backend:**

```bash
# From the backend/ directory
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API base**: http://localhost:8000/api
- **Interactive docs (Swagger)**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

> The backend now expects schema management through Alembic. `AUTO_CREATE_TABLES=true` is available only as a fallback for local/test workflows.

---

### 4. Frontend Setup

```bash
# From the project root
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend will be available at **http://localhost:5173**

The Vite dev server proxies `/api` and `/media` requests to the backend at `localhost:8000` — no CORS issues during development.

---

### 5. Build for Production

```bash
# Frontend
cd frontend
npm run build
# Output goes to frontend/dist/

# Backend — serve with gunicorn in production
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## 🔑 Creating the First Admin User

There's no admin UI for user promotion yet. Use the Python REPL:

```bash
cd backend
python -c "
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import StaffUser, User

async def promote(username):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if not user:
            print('User not found')
            return
        if not user.staff_profile:
            db.add(StaffUser(user_id=user.id, is_superuser=True))
        else:
            user.staff_profile.is_superuser = True
        await db.commit()
        print(f'{username} is now a superuser')

asyncio.run(promote('your_username'))
"
```

---

## 🕷️ Adding a Scraper

Scrapers are registered by decorating an async function in `backend/app/services/scraper.py`:

```python
from app.services.scraper import register_scraper

@register_scraper("my_site")
async def my_site_scraper(url: str) -> dict:
    """
    Scrape a manga from my_site.com.
    Must return:
    {
        "title": "Manga Title",
        "description": "...",
        "author": "...",
        "chapters": [
            {
                "number": 1,
                "title": "Chapter Title",
                "images": ["https://cdn.example.com/page1.jpg", ...]
            },
            ...
        ]
    }
    """
    import httpx
    from bs4 import BeautifulSoup

    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        # ... parse and return data
```

Then use the scraper name `"my_site"` in the admin dashboard.

---

## 📡 API Reference Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user |
| POST | `/api/auth/password/change` | ✅ | Change password |
| GET | `/api/manga/` | — | List manga (paginated) |
| GET | `/api/manga/search?q=...` | — | Search manga |
| GET | `/api/manga/categories` | — | List categories |
| GET | `/api/manga/{slug}` | — | Manga detail |
| GET | `/api/manga/{slug}/chapters` | — | Chapter list |
| GET | `/api/manga/{slug}/recommendations` | — | Related manga |
| GET | `/api/manga/{ms}/chapter/{cs}` | — | Read chapter |
| POST | `/api/manga/{ms}/chapter/{cs}/mark-read` | ✅ | Mark chapter read |
| GET | `/api/manga/{ms}/chapter/{cs}/nav` | — | Prev/next nav |
| GET | `/api/manga/{ms}/chapter/{cs}/comments` | — | List comments |
| POST | `/api/manga/{ms}/chapter/{cs}/comments` | — | Add comment |
| POST | `/api/manga/{slug}/rating` | ✅ | Rate manga (1–5) |
| GET | `/api/bookmarks/` | ✅ | My bookmarks |
| POST | `/api/bookmarks/{slug}` | ✅ | Add bookmark |
| DELETE | `/api/bookmarks/{slug}` | ✅ | Remove bookmark |
| GET | `/api/notifications/` | ✅ | My notifications |
| POST | `/api/notifications/{id}/read` | ✅ | Mark notif read |
| GET | `/api/history/` | ✅ | Reading history |
| GET | `/api/users/profile` | ✅ | My profile |
| PUT | `/api/users/profile` | ✅ | Update profile |
| POST | `/api/users/profile/avatar` | ✅ | Upload avatar |
| GET | `/api/users/{username}` | — | Public profile |
| GET | `/api/staff/scrapers/` | 🔒 Staff | Scraper dashboard |
| POST | `/api/staff/scrapers/add` | 🔒 Staff | Queue new scrape |
| POST | `/api/staff/scrapers/start/{id}` | 🔒 Staff | Start scrape |
| POST | `/api/staff/scrapers/retry/{id}` | 🔒 Staff | Retry errors |
| GET | `/api/staff/scrapers/errors` | 🔒 Staff | List errors |

Full interactive docs at `/api/docs` when the server is running.

---

## 🗃️ Database Models

| Model | Description |
|---|---|
| `User` | Accounts with auth, avatar, bio |
| `StaffUser` | Staff/superuser role mapping for privileged users |
| `Manga` | Title, slug, cover, status, rating cache, sources |
| `Category` | Genre tags (many-to-many with Manga) |
| `Chapter` | Number, slug, images_data (JSON list of URLs) |
| `Comment` | User comments on chapters |
| `Bookmark` | User ↔ Manga bookmarks |
| `Rating` | 1–5 star ratings (one per user per manga) |
| `ReadingHistory` | Last chapter read per user per manga |
| `ChapterReadProgress` | Set of completed chapters per user |
| `Notification` | User notification messages |
| `ScraperError` | Failed scrape attempts with retry tracking |

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `your-super-secret-key` | JWT signing secret (change this!) |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token TTL (24 hours) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./manga.db` | Database connection string |
| `MEDIA_DIR` | `media` | Directory for uploaded files |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | Comma-separated CORS origins |
| `AUTO_CREATE_TABLES` | `false` | Fallback to create tables on app startup instead of using Alembic |

---

## 🌐 Deployment Notes

1. **Change `SECRET_KEY`** — use a long random string (e.g. `openssl rand -hex 32`)
2. **Set `ALLOWED_ORIGINS`** — to your production frontend domain
3. **Serve media files** — in production, configure Nginx to serve the `media/` directory directly for better performance
4. **HTTPS** — always use HTTPS in production; configure via Nginx/Caddy reverse proxy
5. **Database** — SQLite is fine for small-to-medium sites; migrate to PostgreSQL with `asyncpg` for high traffic

---

## 📝 Development Notes

- **Migrations first** — use Alembic for schema changes and fresh setup (`alembic upgrade head`)
- **Auto table creation fallback** — set `AUTO_CREATE_TABLES=true` only for local/test shortcuts
- **Hot reload** — both `uvicorn --reload` and `vite dev` support hot reload
- **Proxy** — Vite proxies `/api` and `/media` to `localhost:8000` in dev
- **Scraper registry** — add new scrapers by decorating functions with `@register_scraper("name")`
- **Background tasks** — scraping runs as FastAPI `BackgroundTask`s; for production consider Celery or ARQ

---

## 📄 License

MIT — free to use, modify, and distribute.
