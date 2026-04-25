import re

from slugify import slugify as _slugify


def make_slug(text: str) -> str:
    """Generate a URL-safe slug from text."""
    return _slugify(text)


def slugify_chapter_number(number) -> str:
    """
    Convert chapter number (Decimal / float / str) to a slug-safe string.
    E.g. 10.5 -> 'chapter-10-5', 10.0 -> 'chapter-10'
    """
    num_str = str(number)
    if "." in num_str:
        int_part, dec_part = num_str.split(".")
        dec_part = dec_part.rstrip("0")
        normalized = f"{int_part}.{dec_part}" if dec_part else int_part
    else:
        normalized = num_str
    slug_number = normalized.replace(".", "-")
    return _slugify(f"chapter-{slug_number}")
