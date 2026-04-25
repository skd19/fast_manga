# Manga Scrapers

This directory contains scraper implementations for various manga websites. Each scraper inherits from `BaseMangaScraper` and implements site-specific parsing logic.

## Architecture

### Base Scraper (`base_scraper.py`)

The `BaseMangaScraper` abstract class provides:
- Async HTTP request handling with retry logic
- Concurrent chapter processing with semaphore control
- Database-backed error tracking via `ScraperError` model
- Automatic retry of previously failed chapters
- Chapter filtering based on latest scraped chapter
- Progress logging and error reporting

**Required Abstract Methods:**
- `headers` - HTTP headers for requests
- `cookies` - HTTP cookies for requests
- `scraper_name` - Unique identifier (e.g., "babato", "toonclash", "weebcentral")
- `parse_chapter_list(html)` - Extract chapter URLs and numbers from manga page
- `parse_chapter_content(html, url)` - Extract chapter number and image URLs from chapter page

**Optional Override:**
- `_get_chapter_list_url(manga_page_url)` - Customize chapter list endpoint

### Error Tracking

Failed chapters are automatically tracked in the database using the `ScraperError` model:

```python
class ScraperError(models.Model):
    manga = ForeignKey(Manga)
    chapter_url = URLField()
    chapter_number = CharField()
    scraper_name = CharField()
    error_message = TextField()
    retry_count = PositiveIntegerField()
    first_failed_at = DateTimeField()
    last_failed_at = DateTimeField()
    resolved = BooleanField()
```

**Features:**
- Automatic retry of unresolved errors on next scrape
- Tracks retry attempts and timestamps
- Marks errors as resolved when successfully scraped
- Query errors by manga, scraper, or resolution status

## Available Scrapers

### BabatoScraper (`babato_scraper.py`)
- **Domain:** `babato.co`
- **Scraper Name:** `babato`
- **Features:** POST-based chapter list fetching, dynamic chapter URL extraction

### ToonClashScraper (`toonclash_scraper.py`)
- **Domain:** `toonclash.com`
- **Scraper Name:** `toonclash`
- **Features:** POST-based chapter list fetching, Cloudflare cookie handling

### WeebCentralScraper (`weebcentral_scraper.py`)
- **Domain:** `weebcentral.com`
- **Scraper Name:** `weebcentral`
- **Features:** 
  - Custom `/full-chapter-list` endpoint
  - Multi-stage chapter number extraction (heading → URL → filename)
  - Series ID extraction from URL

## Adding a New Scraper

1. Create a new file: `yoursite_scraper.py`
2. Inherit from `BaseMangaScraper`
3. Implement required abstract methods:

```python
from manga.scrapers.base_scraper import BaseMangaScraper

class YourSiteScraper(BaseMangaScraper):
    @property
    def headers(self) -> dict:
        return {
            'User-Agent': 'Mozilla/5.0...',
            # ... other headers
        }
    
    @property
    def cookies(self) -> dict:
        return {}  # or required cookies
    
    @property
    def scraper_name(self) -> str:
        return "yoursite"
    
    def parse_chapter_list(self, html: str) -> list[tuple[str, str]]:
        # Return [(chapter_url, chapter_number), ...]
        pass
    
    def parse_chapter_content(self, html: str, url: str) -> tuple[str, list[str]]:
        # Return (chapter_number, [image_urls])
        pass
```

4. The scraper will be auto-discovered by `scrape_manga` command

## Usage

### Command Line

```bash
# Auto-detect scraper from URL
python manage.py scrape_manga <manga_id> <manga_url>

# Specify scraper explicitly
python manage.py scrape_manga <manga_id> <manga_url> --scraper babato

# Create manga from AniList and scrape
python manage.py scrape_manga --anilist-id 30011 <manga_url>

# Adjust concurrency and retries
python manage.py scrape_manga <manga_id> <manga_url> --max-concurrent 10 --max-retries 5
```

### Programmatic Usage

```python
from manga.scrapers.babato_scraper import BabatoScraper
from manga.models import Manga

scraper = BabatoScraper(max_concurrent_chapters=20)
manga = Manga.objects.get(id=1)

# Scrape with callback
def add_chapter(manga, number, images_data):
    # Your chapter creation logic
    pass

await scraper.scrape_manga_chapters_async(
    manga_instance=manga,
    manga_page_url="https://babato.co/manga/...",
    add_chapter_callback=add_chapter
)
```

## Error Handling

### Querying Errors

```python
from manga.models import ScraperError

# Get unresolved errors for a manga
errors = ScraperError.objects.filter(manga_id=43, resolved=False)

# Get errors by scraper
weebcentral_errors = ScraperError.objects.filter(
    scraper_name='weebcentral', 
    resolved=False
)

# Get persistent failures (high retry count)
persistent = ScraperError.objects.filter(retry_count__gte=3, resolved=False)
```

### Manual Resolution

```python
# Mark error as resolved
error = ScraperError.objects.get(id=1)
error.resolved = True
error.save()

# Delete resolved errors
ScraperError.objects.filter(resolved=True).delete()
```

## Configuration

Scrapers can be configured via constructor:

```python
scraper = BabatoScraper(
    max_concurrent_chapters=30,  # Concurrent requests
    max_retries=3,               # Retry attempts per chapter
    timeout=30,                  # Request timeout (seconds)
    log_file='scraper.log'       # Log file path
)
```

## Best Practices

1. **Rate Limiting:** Adjust `max_concurrent_chapters` to avoid overwhelming servers
2. **Error Messages:** Provide descriptive error messages in `parse_*` methods
3. **Logging:** Use `logging.info/warning/error` for debugging
4. **Chapter Numbers:** Return consistent decimal format (e.g., "123", "123.5")
5. **URL Validation:** Validate URLs before returning from `parse_chapter_list`

## Troubleshooting

**Issue:** Chapters not being scraped
- Check `ScraperError` table for failed URLs
- Verify `parse_chapter_list` returns correct format
- Ensure `latest_chapter_number` filtering isn't excluding chapters

**Issue:** High retry counts
- Inspect error messages in `ScraperError.error_message`
- Check if site structure changed (update selectors)
- Verify headers/cookies are still valid

**Issue:** Duplicate chapters
- Database constraint prevents duplicates (`unique_together` on manga + chapter number)
- Check `add_new_chapter` callback handles `IntegrityError`
