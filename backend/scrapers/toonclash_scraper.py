"""
ToonClash manga scraper implementation.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from selectolax.lexbor import LexborHTMLParser

from .base_scraper import BaseMangaScraper

logger = logging.getLogger(__name__)


class ToonClashScraper(BaseMangaScraper):
    """Scraper for toonclash.com (Madara WordPress theme)."""

    @property
    def headers(self) -> dict:
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://toonclash.com/",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://toonclash.com",
            "DNT": "1",
            "Sec-GPC": "1",
            "Alt-Used": "toonclash.com",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Priority": "u=0, i",
        }

    @property
    def cookies(self) -> dict:
        return {
            "cf_clearance": "i2uPnYrPWWoCsynEnl2ovhrldcaTQ6yYs52fL4e8mcU-1767985536-1.2.1.1-EEfxWwPml.1izUXhUviVusVG5Y0NhKe55UMaa3a0.PZaO6REXJpEsdqa_5c7ke6PjUme_uBE_kXPihksaI7S57hsVTDMTIP1B4nHpBnH_3yxyOS8sifkrqz5iErFMsHYWSns6rsqX_kZi9ni3aEN4pkRXLCRDkPKuo7Da_uV65SI9wpeSYqBTaMLnEKhmyoAwZwKVQvdJFSAdoqp0q2fcWiJCtie6Rqs9WZiPqma4Bw",
        }

    @property
    def scraper_name(self) -> str:
        return "toonclash"

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

        chapter_data.reverse()
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
