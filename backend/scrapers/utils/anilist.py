"""
AniList GraphQL API helper — async, no Django dependencies.
"""

import logging
import re

import httpx

from .structs import MangaInfo

logger = logging.getLogger(__name__)

ANILIST_URL = "https://graphql.anilist.co"

GRAPHQL_QUERY = """
query ($id: Int) {
    Media(id: $id, type: MANGA) {
        id
        title { english native }
        synonyms
        description(asHtml: false)
        status
        genres
        coverImage { extraLarge large }
        staff {
            edges {
                role
                node { name { full } }
            }
        }
    }
}
"""

_ENGLISH_RE = re.compile(r"^[A-Za-z0-9', ]+$")


def _pick_english_title(title_obj: dict, synonyms: list[str]) -> str:
    """Return the best English title: english field → english synonym → native."""
    candidate = (title_obj.get("english") or "").strip()

    if candidate and _ENGLISH_RE.match(candidate):
        return candidate

    for syn in synonyms:
        syn = syn.strip()
        if syn and _ENGLISH_RE.match(syn):
            return syn

    return (title_obj.get("native") or candidate or "Unknown").strip()


def _extract_author(staff_edges: list) -> str:
    """Walk staff edges, prefer 'Original Story' > 'Story & Art' > first credit."""
    first = ""
    original_story = ""

    for edge in staff_edges:
        node = edge.get("node") or {}
        name = (node.get("name") or {}).get("full") or ""
        role = edge.get("role") or ""

        if not first:
            first = name

        if role == "Original Story":
            original_story = name
            break
        if role == "Story & Art" and not original_story:
            original_story = name

    return original_story or first


async def get_manga_info(manga_id: int) -> MangaInfo:
    """
    Fetch manga metadata from AniList by numeric ID.
    Returns a MangaInfo dataclass (fields may be empty strings on failure).
    """
    payload = {"query": GRAPHQL_QUERY, "variables": {"id": manga_id}}
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    title = author = description = image = status = ""
    genres: list[str] = []
    db_id = None

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(ANILIST_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        media = (data.get("data") or {}).get("Media")
        if not media:
            errors = data.get("errors", [])
            for err in errors:
                logger.error("AniList error: %s", err.get("message"))
            return MangaInfo(
                title=title,
                author=author,
                status=status,
                description=description,
                genres=genres,
                image=image,
                id=db_id,
            )

        db_id = media.get("id")
        status = media.get("status", "")
        description = media.get("description") or ""
        genres = media.get("genres") or []
        image = (
            (media.get("coverImage") or {}).get("extraLarge")
            or (media.get("coverImage") or {}).get("large")
            or ""
        )

        title_obj = media.get("title") or {}
        synonyms = media.get("synonyms") or []
        title = _pick_english_title(title_obj, synonyms)

        staff_edges = (media.get("staff") or {}).get("edges") or []
        author = _extract_author(staff_edges)

        logger.info("AniList: fetched '%s' (id=%s)", title, db_id)

    except httpx.HTTPStatusError as exc:
        logger.error("AniList HTTP error %s: %s", exc.response.status_code, exc)
    except httpx.RequestError as exc:
        logger.error("AniList request error: %s", exc)
    except Exception as exc:
        logger.error("AniList unexpected error: %s", exc, exc_info=True)

    return MangaInfo(
        title=title,
        author=author,
        status=status,
        description=description,
        genres=genres,
        image=image,
        id=db_id,
    )
