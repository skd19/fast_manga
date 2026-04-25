"""
Base scraper class for manga websites — FastAPI / SQLAlchemy edition.

All Django dependencies removed. DB operations use AsyncSessionLocal directly.
Site-specific scrapers subclass BaseMangaScraper and implement the three
abstract methods: headers, cookies, scraper_name, parse_chapter_list,
parse_chapter_content.
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from decimal import Decimal, InvalidOperation
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)


class BaseMangaScraper(ABC):
    """
    Abstract base class for manga scrapers.

    Provides:
    - Concurrent chapter fetching with semaphore control
    - 429 / rate-limit handling
    - Per-chapter retry loop
    - Automatic DB persistence via scrapers.utils.storage helpers
    - ScraperError tracking

    Subclasses must implement:
    - headers  (property)
    - cookies  (property)
    - scraper_name  (property)
    - parse_chapter_list(html) -> list[tuple[url, chapter_number]]
    - parse_chapter_content(html, url) -> tuple[chapter_number, list[image_urls]]
    """

    def __init__(
        self,
        max_concurrent_chapters: int = 30,
        max_retries: int = 3,
        timeout: int = 30,
    ):
        self.max_concurrent_chapters = max_concurrent_chapters
        self.max_retries = max_retries
        self.timeout = timeout

        # Rate-limit gate — shared across all concurrent requests
        self._can_request: bool = True
        self._rate_limit_lock: asyncio.Lock = asyncio.Lock()

    # ── Abstract interface ────────────────────────────────────────────────────

    @property
    @abstractmethod
    def headers(self) -> dict:
        """HTTP headers to send with every request."""

    @property
    @abstractmethod
    def cookies(self) -> dict:
        """HTTP cookies to send with every request (empty dict if none needed)."""

    @property
    @abstractmethod
    def scraper_name(self) -> str:
        """Unique string identifier for this scraper (e.g. 'mangabuddy')."""

    @abstractmethod
    def parse_chapter_list(self, html: str) -> list[tuple[str, str]]:
        """
        Parse manga-page HTML into a list of (chapter_url, chapter_number) tuples.
        Return in ascending chapter-number order (oldest first).
        chapter_number may be "Unknown" if it cannot be extracted.
        """

    @abstractmethod
    def parse_chapter_content(
        self, html: str, url: str
    ) -> tuple[str | None, list[str]]:
        """
        Parse chapter-page HTML into (chapter_number, [image_url, ...]).
        chapter_number may be None/"Unknown" on failure.
        """

    # ── Overridable hooks ─────────────────────────────────────────────────────

    def should_skip_chapter(
        self,
        chapter_number_str: str,
        latest_chapter_number: Optional[Decimal],
    ) -> bool:
        """Return True if the chapter already exists in the DB (number <= latest)."""
        if not latest_chapter_number or chapter_number_str == "Unknown":
            return False
        try:
            return Decimal(chapter_number_str) <= latest_chapter_number
        except (InvalidOperation, ValueError):
            return False

    def _get_chapter_list_url(self, manga_page_url: str) -> str:
        """
        URL to fetch the chapter list from.
        Override in subclasses where the list lives on a different endpoint.
        Default: same URL as the manga page.
        """
        return manga_page_url

    async def _fetch_chapter_list_html(
        self, session: aiohttp.ClientSession, url: str
    ) -> str:
        """
        Fetch the chapter-list HTML.
        Override to add pre/post processing (e.g. MangaBuddy's API call).
        """
        return await self._fetch_url(session, url)

    # ── HTTP fetch with rate-limit handling ───────────────────────────────────

    async def _fetch_url(
        self,
        session: aiohttp.ClientSession,
        url: str,
        timeout: Optional[int] = None,
        data: Optional[dict] = None,
        use_cookies: bool = True,
        **kwargs,
    ) -> str:
        """
        Fetch `url` via GET (or POST if `data` is given).
        Automatically handles HTTP 429 with an 8-second back-off.
        """
        req_timeout = aiohttp.ClientTimeout(total=timeout or self.timeout)
        cookies = self.cookies if use_cookies else None

        # Honour global rate-limit gate
        while True:
            async with self._rate_limit_lock:
                if self._can_request:
                    break
            logger.debug("Rate-limited — waiting 1 s …")
            await asyncio.sleep(1)

        async def _do_request() -> str:
            if data:
                async with session.post(
                    url,
                    headers=self.headers,
                    cookies=cookies,
                    data=data,
                    timeout=req_timeout,
                    **kwargs,
                ) as r:
                    r.raise_for_status()
                    return await r.text()
            else:
                async with session.get(
                    url,
                    headers=self.headers,
                    cookies=cookies,
                    timeout=req_timeout,
                    **kwargs,
                ) as r:
                    r.raise_for_status()
                    return await r.text()

        try:
            return await _do_request()
        except aiohttp.ClientResponseError as exc:
            if exc.status == 429:
                async with self._rate_limit_lock:
                    if self._can_request:
                        self._can_request = False
                        logger.warning("HTTP 429 on %s — waiting 8 s …", url)
                        await asyncio.sleep(8)
                        self._can_request = True
                        logger.info("Rate-limit cleared")
                # Retry once after back-off
                return await _do_request()
            raise

    # ── Single chapter: fetch → parse → save ─────────────────────────────────

    async def fetch_and_process_chapter(
        self,
        session: aiohttp.ClientSession,
        chapter_url: str,
        manga_id: int,
        semaphore: asyncio.Semaphore,
        chapter_number: Optional[str] = None,
    ) -> Optional[str]:
        """
        Fetch one chapter page, parse images, persist to DB.
        Returns chapter_url on success, None on failure.
        """
        async with semaphore:
            try:
                logger.info("Fetching chapter: %s", chapter_url)
                html = await self._fetch_url(session, chapter_url)

                extracted_number, images = self.parse_chapter_content(html, chapter_url)
                final_number = (
                    chapter_number
                    if (chapter_number and chapter_number != "Unknown")
                    else extracted_number
                )

                if not final_number:
                    logger.warning(
                        "Could not determine chapter number for %s", chapter_url
                    )
                    return None

                if not images:
                    logger.warning(
                        "No images found for chapter %s at %s",
                        final_number,
                        chapter_url,
                    )

                await self._save_chapter(manga_id, final_number, images)
                logger.info(
                    "Saved chapter %s (%d images) from %s",
                    final_number,
                    len(images),
                    chapter_url,
                )
                return chapter_url

            except aiohttp.ClientResponseError as exc:
                logger.error("HTTP %s for %s: %s", exc.status, chapter_url, exc.message)
            except aiohttp.ClientError as exc:
                logger.error("Network error for %s: %s", chapter_url, exc)
            except asyncio.TimeoutError:
                logger.error("Timeout for %s", chapter_url)
            except Exception as exc:
                logger.error(
                    "Unexpected error processing %s: %s",
                    chapter_url,
                    exc,
                    exc_info=True,
                )
            return None

    async def _save_chapter(
        self, manga_id: int, number: str, images_data: list[str]
    ) -> None:
        """Persist a chapter to the database (upsert)."""
        from scrapers.utils.storage import save_chapter

        await save_chapter(manga_id, number, images_data)

    # ── Batch processing ──────────────────────────────────────────────────────

    async def _process_batch_of_urls(
        self,
        session: aiohttp.ClientSession,
        items: list[tuple[str, str]],  # [(chapter_url, chapter_number), ...]
        manga_id: int,
        semaphore: asyncio.Semaphore,
        attempt_name: str,
    ) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
        """
        Process a list of (url, chapter_number) concurrently.
        Returns (successful_items, failed_items).
        """
        if not items:
            return [], []

        tasks = {
            asyncio.create_task(
                self.fetch_and_process_chapter(
                    session, url, manga_id, semaphore, chapter_num
                )
            ): (url, chapter_num)
            for url, chapter_num in items
        }

        logger.info(
            "[%s] Processing %d chapters (concurrency=%d)",
            attempt_name,
            len(tasks),
            self.max_concurrent_chapters,
        )

        results = await asyncio.gather(*tasks.keys(), return_exceptions=True)

        successful, failed = [], []
        for task, result in zip(tasks.keys(), results):
            url, num = tasks[task]
            if isinstance(result, Exception) or result is None:
                err_msg = (
                    str(result) if isinstance(result, Exception) else "returned None"
                )
                logger.warning("[%s] Failed %s: %s", attempt_name, url, err_msg)
                failed.append((url, num))
                await self._record_error(manga_id, url, num, err_msg)
            else:
                successful.append((url, num))

        return successful, failed

    # ── Retry previously failed chapters ─────────────────────────────────────

    async def _retry_failed_chapters(
        self,
        session: aiohttp.ClientSession,
        manga_id: int,
        semaphore: asyncio.Semaphore,
    ) -> tuple[set[str], set[str]]:
        """
        Query ScraperError table for unresolved errors and retry them.
        Returns (recovered_urls, still_failed_urls).
        """
        from scrapers.utils.storage import get_unresolved_errors, mark_error_resolved

        error_items = await get_unresolved_errors(manga_id, self.scraper_name)
        if not error_items:
            return set(), set()

        logger.info("Retrying %d previously failed chapters …", len(error_items))
        successful, failed = await self._process_batch_of_urls(
            session, error_items, manga_id, semaphore, "DB Retry"
        )

        recovered: set[str] = set()
        for url, _ in successful:
            recovered.add(url)
            await mark_error_resolved(manga_id, url)

        still_failed = {url for url, _ in failed}
        logger.info("DB Retry: recovered %d / %d", len(recovered), len(error_items))
        return recovered, still_failed

    # ── Error recording ───────────────────────────────────────────────────────

    async def _record_error(
        self,
        manga_id: int,
        chapter_url: str,
        chapter_number: Optional[str],
        error_message: str,
    ) -> None:
        from scrapers.utils.storage import record_scraper_error

        try:
            await record_scraper_error(
                manga_id,
                chapter_url,
                self.scraper_name,
                chapter_number,
                error_message,
            )
        except Exception as exc:
            logger.error("Failed to record scraper error: %s", exc)

    # ── Main entry point ──────────────────────────────────────────────────────

    async def scrape_manga_chapters_async(
        self,
        manga_page_url: str,
        manga_id: Optional[int] = None,
        anilist_id: Optional[int] = None,
    ) -> None:
        """
        Full scrape pipeline:
        1. Resolve / create manga in DB
        2. Retry any previously-failed chapters
        3. Fetch and parse chapter list
        4. Filter chapters already in DB
        5. Process new chapters (with retry loop)
        6. Update manga boundary chapter FKs

        Args:
            manga_page_url: URL of the manga's chapter-list page
            manga_id:       Existing DB primary key (optional)
            anilist_id:     AniList numeric ID — fetches metadata & creates manga
                            if not yet in DB (optional)
        """
        from app.database import AsyncSessionLocal
        from app.models.manga import Chapter
        from sqlalchemy import select

        from scrapers.utils.storage import get_or_create_manga, update_manga_boundaries

        # ── Step 1: Resolve manga ─────────────────────────────────────────────
        try:
            resolved_id = await get_or_create_manga(
                manga_id=manga_id,
                anilist_id=anilist_id,
                manga_url=manga_page_url,
            )
        except Exception as exc:
            logger.error("Could not resolve manga: %s", exc)
            return

        if resolved_id is None:
            logger.error("get_or_create_manga returned None — aborting")
            return

        logger.info(
            "Scraping '%s' (manga_id=%s) with scraper '%s'",
            manga_page_url,
            resolved_id,
            self.scraper_name,
        )

        # ── Step 2: Get latest chapter in DB (for filtering) ──────────────────
        latest_number: Optional[Decimal] = None
        async with AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    select(Chapter.number)
                    .where(Chapter.manga_id == resolved_id)
                    .order_by(Chapter.number.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if row is not None:
                latest_number = Decimal(str(row))

        logger.info("Latest chapter in DB: %s", latest_number)

        async with aiohttp.ClientSession() as session:
            # ── Step 3: Retry old failures ────────────────────────────────────
            semaphore = asyncio.Semaphore(self.max_concurrent_chapters)
            recovered_urls, still_failed = await self._retry_failed_chapters(
                session, resolved_id, semaphore
            )

            # ── Step 4: Fetch & parse chapter list ───────────────────────────
            chapter_list_url = self._get_chapter_list_url(manga_page_url)
            logger.info("Fetching chapter list from: %s", chapter_list_url)

            try:
                list_html = await self._fetch_chapter_list_html(
                    session, chapter_list_url
                )
                all_items = self.parse_chapter_list(list_html)
                logger.info("Found %d chapters in source", len(all_items))
            except Exception as exc:
                logger.error(
                    "Fatal error fetching chapter list: %s", exc, exc_info=True
                )
                return

            # ── Step 5: Filter already-scraped chapters ───────────────────────
            new_items = [
                (url, num)
                for url, num in all_items
                if not self.should_skip_chapter(num, latest_number)
            ]
            skipped = len(all_items) - len(new_items)
            logger.info(
                "After filter: %d new, %d skipped (already in DB)",
                len(new_items),
                skipped,
            )

            if not new_items:
                logger.info("Nothing new to scrape.")
            else:
                # ── Step 6: Process with retry loop ───────────────────────────
                pending = list(new_items)
                all_success: set[str] = set()

                for attempt in range(self.max_retries + 1):
                    if not pending:
                        break

                    label = (
                        "Initial"
                        if attempt == 0
                        else f"Retry {attempt}/{self.max_retries}"
                    )
                    logger.info("[%s] %d URLs to process", label, len(pending))

                    ok, failed = await self._process_batch_of_urls(
                        session, pending, resolved_id, semaphore, label
                    )
                    for url, _ in ok:
                        all_success.add(url)
                    pending = failed

                    logger.info(
                        "[%s] done — ok=%d, failed=%d",
                        label,
                        len(ok),
                        len(failed),
                    )

                logger.info(
                    "Summary: %d/%d chapters saved successfully",
                    len(all_success),
                    len(new_items),
                )

        # ── Step 7: Update manga boundary chapters ────────────────────────────
        try:
            await update_manga_boundaries(resolved_id)
            logger.info("Updated manga boundary chapters (manga_id=%s)", resolved_id)
        except Exception as exc:
            logger.error("Failed to update boundaries: %s", exc)

        logger.info(
            "Scraper '%s' finished for manga_id=%s", self.scraper_name, resolved_id
        )
