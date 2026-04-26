"""Shared validation helpers for LLM-output prompt validators.

LLMs sometimes return valid-but-non-canonical values (e.g. "Critical" instead
of "red"). These helpers coerce common synonyms to the canonical enum values
the database expects, so a single odd word from the model doesn't fail the
whole task.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


# Canonical traffic-light severity buckets used in the DB.
_SEVERITY_SYNONYMS = {
    # red = must fix
    "red": "red",
    "critical": "red",
    "high": "red",
    "severe": "red",
    "major": "red",
    "must": "red",
    "must-fix": "red",
    "must_fix": "red",
    "blocker": "red",
    "error": "red",
    "urgent": "red",
    # amber = should fix
    "amber": "amber",
    "yellow": "amber",
    "medium": "amber",
    "moderate": "amber",
    "should": "amber",
    "should-fix": "amber",
    "should_fix": "amber",
    "warning": "amber",
    "warn": "amber",
    "caution": "amber",
    # blue = suggestion
    "blue": "blue",
    "low": "blue",
    "minor": "blue",
    "info": "blue",
    "note": "blue",
    "suggestion": "blue",
    "suggestion-only": "blue",
    "tip": "blue",
    "nit": "blue",
}


# Canonical insight categories used by the editor UI.
_CATEGORY_SYNONYMS = {
    # Pacing
    "pacing": "Pacing",
    "tempo": "Pacing",
    "rhythm": "Pacing",
    "tension": "Pacing",
    # Characters
    "characters": "Characters",
    "character": "Characters",
    "cast": "Characters",
    "characterization": "Characters",
    # Relationships
    "relationships": "Relationships",
    "relationship": "Relationships",
    "dynamics": "Relationships",
    # Structure
    "structure": "Structure",
    "structural": "Structure",
    "plot": "Structure",
    "story-structure": "Structure",
    # Continuity
    "continuity": "Continuity",
    "consistency": "Continuity",
    "logic": "Continuity",
    # Voice
    "voice": "Voice",
    "narrative voice": "Voice",
    "pov": "Voice",
    "point of view": "Voice",
    "narration": "Voice",
    # Dialogue
    "dialogue": "Dialogue",
    "dialog": "Dialogue",
    "speech": "Dialogue",
    # Theme
    "theme": "Theme",
    "thematic": "Theme",
    "themes": "Theme",
    # Worldbuilding
    "worldbuilding": "Worldbuilding",
    "world-building": "Worldbuilding",
    "world": "Worldbuilding",
    "setting": "Worldbuilding",
    # Stakes
    "stakes": "Stakes",
    "consequences": "Stakes",
    "risk": "Stakes",
}


def coerce_severity(raw: object) -> str | None:
    """Return canonical severity ('red'/'amber'/'blue') or None if uncoercible."""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    return _SEVERITY_SYNONYMS.get(key)


def coerce_category(raw: object) -> str | None:
    """Return canonical category or None if uncoercible."""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    # Try exact lower-cased match first.
    if key in _CATEGORY_SYNONYMS:
        return _CATEGORY_SYNONYMS[key]
    # Some models return things like "Character/Relationships" — split and try first half.
    if "/" in key:
        head = key.split("/", 1)[0].strip()
        if head in _CATEGORY_SYNONYMS:
            return _CATEGORY_SYNONYMS[head]
    return None


def normalize_insight_item(item: dict) -> dict | None:
    """Coerce one insight finding into canonical shape, or return None to drop it.

    Drops items missing required fields after coercion attempts. Logs at WARNING
    so prompt-tuning regressions are visible in worker logs.
    """
    if not isinstance(item, dict):
        logger.warning("Dropping non-dict insight item: %r", type(item).__name__)
        return None

    severity = coerce_severity(item.get("severity"))
    category = coerce_category(item.get("category"))
    title = item.get("title")
    body = item.get("body")
    refs = item.get("refs", [])

    if severity is None:
        logger.warning("Dropping insight with uncoercible severity %r", item.get("severity"))
        return None
    if category is None:
        logger.warning("Dropping insight with uncoercible category %r", item.get("category"))
        return None
    if not title or not isinstance(title, str):
        logger.warning("Dropping insight with missing title")
        return None
    if not body or not isinstance(body, str):
        logger.warning("Dropping insight with missing body")
        return None
    if not isinstance(refs, list):
        refs = []

    return {
        "severity": severity,
        "category": category,
        "title": title.strip(),
        "body": body.strip(),
        "refs": [r for r in refs if isinstance(r, str)],
    }
