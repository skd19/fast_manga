from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create all tables on startup."""
    from app.models import user, manga  # noqa – import so Base registers them

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _backfill_staff_users(conn)


async def _backfill_staff_users(conn):
    """Copy legacy users.is_staff/is_superuser flags into staff_users if present."""
    users_info = await conn.execute(text("PRAGMA table_info(users)"))
    user_columns = {row[1] for row in users_info.fetchall()}
    if not {"is_staff", "is_superuser"}.intersection(user_columns):
        return

    staff_info = await conn.execute(text("PRAGMA table_info(staff_users)"))
    staff_columns = {row[1] for row in staff_info.fetchall()}
    if not {"user_id", "is_superuser"}.issubset(staff_columns):
        return

    await conn.execute(
        text(
            """
            INSERT INTO staff_users (user_id, is_superuser)
            SELECT users.id, COALESCE(users.is_superuser, 0)
            FROM users
            LEFT JOIN staff_users ON staff_users.user_id = users.id
            WHERE staff_users.user_id IS NULL
              AND (COALESCE(users.is_staff, 0) = 1 OR COALESCE(users.is_superuser, 0) = 1)
            """
        )
    )
