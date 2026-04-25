"""
Data structures for scraper utilities.
No Django dependencies — plain Python dataclasses.
"""

from dataclasses import dataclass, field


@dataclass
class MangaInfo:
    title: str
    author: str
    status: str
    description: str
    genres: list[str]
    image: str  # cover image URL (raw, not downloaded yet)
    id: int = None  # AniList ID

    @property
    def clean_description(self) -> str:
        """Return only the first non-empty line of the description."""
        if not self.description:
            return ""
        for line in self.description.splitlines():
            line = line.strip()
            if line:
                return line
        return ""

    @property
    def get_status(self) -> str:
        """Map AniList status string to our internal status."""
        return {
            "FINISHED": "completed",
            "RELEASING": "ongoing",
            "NOT_YET_RELEASED": "not_yet_released",
            "CANCELLED": "cancelled",
            "HIATUS": "hiatus",
        }.get(self.status, "ongoing")
