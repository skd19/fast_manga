"""
Scraper registry — import this module to register all site scrapers.

Importing this module populates app.services.scraper.SCRAPERS with
BaseMangaScraper instances keyed by their scraper_name.

Usage (in app/main.py lifespan):
    import scrapers  # noqa — triggers registration
"""

import logging

logger = logging.getLogger(__name__)

try:
    from app.services.scraper import SCRAPERS

    from .mangabuddy_scraper import MangabuddyScraper
    from .manhuafast_scraper import ManhuafastScraper
    from .toonclash_scraper import ToonClashScraper
    from .weebcentral_scraper import WeebCentralScraper

    SCRAPERS["mangabuddy"] = MangabuddyScraper()
    SCRAPERS["manhuafast"] = ManhuafastScraper()
    SCRAPERS["toonclash"] = ToonClashScraper()
    SCRAPERS["weebcentral"] = WeebCentralScraper()

    logger.info("Registered scrapers: %s", ", ".join(SCRAPERS.keys()))

except Exception as exc:
    logger.error("Failed to register scrapers: %s", exc, exc_info=True)
