"""
MangaBuddy manga scraper implementation.
"""

from __future__ import annotations

import logging
import re
from decimal import Decimal, InvalidOperation

import aiohttp
from selectolax.lexbor import LexborHTMLParser

from .base_scraper import BaseMangaScraper

logger = logging.getLogger(__name__)

_CHAPTER_NUM_RE = re.compile(r"chapter\s+(?P<chapter>\d+(?:\.\d+)?)")


class MangabuddyScraper(BaseMangaScraper):
    """Scraper for mangabuddy.com."""

    @property
    def headers(self) -> dict:
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "DNT": "1",
            "Sec-GPC": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Priority": "u=0, i",
        }

    @property
    def cookies(self) -> dict:
        return {}

    @property
    def scraper_name(self) -> str:
        return "mangabuddy"

    async def _fetch_chapter_list_html(
        self, session: aiohttp.ClientSession, url: str
    ) -> str:
        """
        MangaBuddy exposes a JSON API for chapter lists.
        1. Fetch the manga page to extract bookId.
        2. Hit the API endpoint.
        3. Return the API HTML + a canonical link tag so parse_chapter_list can
           reconstruct full URLs.
        """
        page_html = await self._fetch_url(session, url)

        match = re.search(r"var\s+bookId\s*=\s*(\d+)\s*;", page_html)
        if not match:
            logger.warning(
                "Could not find bookId for %s — falling back to page HTML", url
            )
            return page_html

        book_id = match.group(1)
        api_url = f"https://mangabuddy.com/api/manga/{book_id}/chapters"
        params = {"source": "detail"}

        request_timeout = aiohttp.ClientTimeout(total=self.timeout)
        async with session.get(
            api_url,
            headers={**self.headers, "Referer": url},
            params=params,
            timeout=request_timeout,
        ) as resp:
            resp.raise_for_status()
            list_html = await resp.text()

        # Append a canonical tag so parse_chapter_list can build full URLs
        return list_html + f'<link rel="canonical" href="{url}">'

    def parse_chapter_list(self, html: str) -> list[tuple[str, str]]:
        tree = LexborHTMLParser(html)
        chapter_links = tree.css("#chapter-list li > a[href]")

        canonical_node = tree.css_first('link[rel="canonical"]')
        current_url = (
            canonical_node.attributes.get("href") or "" if canonical_node else ""
        )
        parts = current_url.split("/")
        protocol = parts[0] + "//" if parts else "https://"
        domain = parts[2] if len(parts) > 2 else ""

        chapter_data = []
        for link in chapter_links:
            href = link.attributes.get("href") or ""
            if href.startswith("/"):
                href = protocol + domain + href

            title_node = link.css_first(".chapter-title")
            raw_text = title_node.text(strip=True).lower() if title_node else ""
            m = _CHAPTER_NUM_RE.match(raw_text)
            if m:
                try:
                    chapter_num = str(Decimal(m.group("chapter")))
                except InvalidOperation:
                    chapter_num = "Unknown"
            else:
                logger.warning("Cannot parse chapter number from: '%s'", raw_text)
                chapter_num = "Unknown"

            chapter_data.append((href, chapter_num))

        chapter_data.reverse()
        return chapter_data

    def parse_chapter_content(
        self, html: str, url: str
    ) -> tuple[str | None, list[str]]:
        tree = LexborHTMLParser(html)

        heading = tree.css_first("#breadcrumbs-container .breadcrumbs-item[style] span")
        if not heading:
            logger.warning("No chapter heading found for %s", url)
            return None, []

        raw = heading.text(strip=True)
        chapter_text = (
            raw.lower().split(":")[0].split("chapter ")[-1].strip()
            if raw
            else "Unknown"
        )

        m = re.search(r"var chapImages = '(.*?)'", tree.html or "")
        if not m:
            logger.warning("No chapImages variable found for %s", url)
            return chapter_text, []

        images = [img.strip() for img in m.group(1).split(",") if img.strip()]
        return chapter_text, images
