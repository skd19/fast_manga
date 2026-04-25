"""
Manhuafast manga scraper implementation.
"""

from __future__ import annotations

import logging
from decimal import Decimal

import aiohttp
from selectolax.lexbor import LexborHTMLParser

from .base_scraper import BaseMangaScraper

logger = logging.getLogger(__name__)


class ManhuafastScraper(BaseMangaScraper):
    """Scraper for manhuafast.com (Madara WordPress theme)."""

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
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            "Priority": "u=0, i",
        }

    @property
    def cookies(self) -> dict:
        return {}

    @property
    def scraper_name(self) -> str:
        return "manhuafast"

    def _get_chapter_list_url(self, manga_page_url: str) -> str:
        """Manhuafast chapter list lives at <manga_url>ajax/chapters/ (POST)."""
        return manga_page_url.rstrip("/") + "/ajax/chapters/"

    async def _fetch_chapter_list_html(
        self, session: aiohttp.ClientSession, url: str
    ) -> str:
        """
        Manhuafast requires a POST to the ajax/chapters/ endpoint.
        The base class sends GET by default; override to use POST instead.
        """
        request_timeout = aiohttp.ClientTimeout(total=self.timeout)
        async with session.post(
            url,
            headers=self.headers,
            timeout=request_timeout,
        ) as response:
            response.raise_for_status()
            return await response.text()

    def parse_chapter_list(self, html: str) -> list[tuple[str, str]]:
        tree = LexborHTMLParser(html)
        chapter_links = tree.css(".listing-chapters_wrap li.wp-manga-chapter > a[href]")

        chapter_data = []
        for link in chapter_links:
            href = link.attributes.get("href")
            if not href:
                continue
            text = link.text(strip=True)
            try:
                chapter_num = str(
                    Decimal(text.lower().split("-")[0].split("chapter ")[-1].strip())
                )
            except (ValueError, IndexError):
                chapter_num = "Unknown"
            chapter_data.append((href, chapter_num))

        chapter_data.reverse()  # oldest first
        return chapter_data

    def parse_chapter_content(
        self, html: str, url: str
    ) -> tuple[str | None, list[str]]:
        tree = LexborHTMLParser(html)

        heading = tree.css_first("h1#chapter-heading")
        if not heading:
            logger.warning("No chapter heading found for %s", url)
            return None, []

        raw = heading.text(strip=True)
        chapter_text = raw.strip().split("Chapter ")[-1] if raw else "Unknown"

        images = [
            src.strip()
            for img in tree.css(".reading-content img[data-src]")
            if (src := img.attrs.get("data-src"))
        ]
        return chapter_text, images
