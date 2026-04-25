"""
WeebCentral manga scraper implementation.
"""

from __future__ import annotations

import asyncio
import logging
import re
from decimal import Decimal
from typing import Optional

import aiohttp
from selectolax.lexbor import LexborHTMLParser

from .base_scraper import BaseMangaScraper

logger = logging.getLogger(__name__)


class WeebCentralScraper(BaseMangaScraper):
    """
    Scraper for weebcentral.com.

    Quirks:
    - Chapter list lives at /series/{ID}/full-chapter-list
    - Chapter images are at {chapter_url}/images?is_prev=False&current_page=1&reading_style=long_strip
    """

    @property
    def headers(self) -> dict:
        return {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.7",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "priority": "u=0, i",
            "referer": "https://weebcentral.com/",
            "sec-ch-ua": '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "sec-gpc": "1",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        }

    @property
    def cookies(self) -> dict:
        return {}

    @property
    def scraper_name(self) -> str:
        return "weebcentral"

    def _extract_series_id(self, manga_page_url: str) -> Optional[str]:
        try:
            parts = manga_page_url.rstrip("/").split("/")
            if "series" in parts:
                idx = parts.index("series")
                if len(parts) > idx + 1:
                    return parts[idx + 1]
        except (ValueError, IndexError) as exc:
            logger.error("Could not extract series ID from %s: %s", manga_page_url, exc)
        return None

    def _get_chapter_list_url(self, manga_page_url: str) -> str:
        series_id = self._extract_series_id(manga_page_url)
        if not series_id:
            logger.error(
                "Could not extract series ID from %s — using original URL",
                manga_page_url,
            )
            return manga_page_url
        return f"https://weebcentral.com/series/{series_id}/full-chapter-list"

    def parse_chapter_list(self, html: str) -> list[tuple[str, str]]:
        tree = LexborHTMLParser(html)
        link_nodes = tree.css(".flex.items-center a[href]")

        chapter_data = []
        for link in link_nodes:
            href = link.attrs.get("href", "")
            if not href:
                continue

            span = link.css_first(
                "a>span.grow.flex.items-center.gap-2>span:nth-child(1)"
            )
            text = span.text(strip=True) if span else ""
            chapter_num = "Unknown"
            try:
                if "Chapter" in text:
                    chapter_num = str(Decimal(text.split("Chapter ")[-1].strip()))
                else:
                    m = re.search(r"\d+(\.\d+)?", text)
                    if m:
                        chapter_num = str(Decimal(m.group(0)))
            except Exception:
                pass

            chapter_data.append((href, chapter_num))

        chapter_data.reverse()
        return chapter_data

    def parse_chapter_content(self, html: str, url: str) -> tuple[str, list[str]]:
        tree = LexborHTMLParser(html)

        images = [
            src for img in tree.css("section img") if (src := img.attrs.get("src"))
        ]

        chapter_number: Optional[str] = None

        # Strategy 1: h1 in section
        try:
            h1_text = tree.css_first("section > h1").text(strip=True)
            if h1_text:
                if "Chapter" in h1_text:
                    chapter_number = str(
                        Decimal(h1_text.split("Chapter")[-1].strip().split(" ")[0])
                    )
                else:
                    m = re.search(r"\d+(\.\d+)?", h1_text)
                    if m:
                        chapter_number = str(Decimal(m.group(0)))
        except Exception:
            pass

        # Strategy 2: URL slug
        if not chapter_number:
            try:
                slug = url.rstrip("/").split("/")[-1]
                m = re.search(
                    r"(?:Chapter-)?(\d+(?:-\d+)?(?:-\d+)?)(?:-|$)", slug, re.IGNORECASE
                )
                if m:
                    chapter_number = str(Decimal(m.group(1).replace("-", ".")))
            except Exception:
                pass

        # Strategy 3: image filename
        if not chapter_number:
            for img_url in images:
                try:
                    filename = img_url.split("/")[-1]
                    m = re.search(r"^(\d+)-\d+\.", filename)
                    if m:
                        chapter_number = str(Decimal(m.group(1)))
                        break
                except Exception:
                    continue

        if not chapter_number:
            logger.warning("Could not determine chapter number for %s", url)
            chapter_number = "Unknown"

        return chapter_number, images

    async def fetch_and_process_chapter(
        self,
        session: aiohttp.ClientSession,
        chapter_url: str,
        manga_id: int,
        semaphore: asyncio.Semaphore,
        chapter_number: Optional[str] = None,
    ) -> Optional[str]:
        """
        Override: WeebCentral serves images at {chapter_url}/images with query params.
        """
        async with semaphore:
            try:
                images_url = chapter_url.rstrip("/") + "/images"
                params = {
                    "is_prev": "False",
                    "current_page": "1",
                    "reading_style": "long_strip",
                }
                request_timeout = aiohttp.ClientTimeout(total=self.timeout)
                async with session.get(
                    images_url,
                    params=params,
                    headers=self.headers,
                    timeout=request_timeout,
                ) as response:
                    response.raise_for_status()
                    html = await response.text()

                extracted_number, images = self.parse_chapter_content(html, chapter_url)
                final_number = (
                    chapter_number
                    if (chapter_number and chapter_number != "Unknown")
                    else extracted_number
                )

                if not final_number:
                    logger.warning("No chapter number for %s", chapter_url)
                    return None
                if not images:
                    logger.warning(
                        "No images for chapter %s at %s", final_number, chapter_url
                    )
                    return None

                await self._save_chapter(manga_id, final_number, images)
                logger.info(
                    "Saved WeebCentral chapter %s (%d images)",
                    final_number,
                    len(images),
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
                    "Unexpected error for %s: %s", chapter_url, exc, exc_info=True
                )
            return None
