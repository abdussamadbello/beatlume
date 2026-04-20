"""Tests for the analytics computation engine."""

from app.services.analytics.tension import compute_tension_curve
from app.services.analytics.pacing import analyze_pacing
from app.services.analytics.presence import compute_presence
from app.services.analytics.arcs import compute_character_arc
from app.services.analytics.health import compute_health
from app.services.analytics.sparkline import tension_sparkline


# ── Tension Curve ──────────────────────────────────────────

def test_tension_curve_basic():
    tensions = [2, 3, 5, 4, 7, 6, 8, 9, 7, 8]
    result = compute_tension_curve(tensions)
    assert "points" in result
    assert len(result["points"]) > 0
    assert "metrics" in result
    assert result["metrics"]["max"] == 9
    assert result["metrics"]["min"] == 2


def test_tension_curve_empty():
    result = compute_tension_curve([])
    assert result["points"] == []
    assert result["metrics"]["mean"] == 0


def test_tension_curve_single():
    result = compute_tension_curve([5])
    assert len(result["points"]) == 200
    assert result["metrics"]["mean"] == 5


def test_tension_curve_two_points():
    result = compute_tension_curve([3, 8])
    assert len(result["points"]) == 200
    assert result["metrics"]["range"] == 5


def test_tension_curve_peaks_detected():
    # Clear peak at position 4 (value 9) surrounded by lower values
    tensions = [2, 3, 4, 5, 9, 5, 4, 3, 2, 3]
    result = compute_tension_curve(tensions)
    assert len(result["peaks"]) >= 1


def test_tension_curve_metrics():
    tensions = [1, 5, 10, 3, 7]
    result = compute_tension_curve(tensions)
    m = result["metrics"]
    assert m["max"] == 10
    assert m["min"] == 1
    assert m["range"] == 9
    assert 0 <= m["climax_position"] < len(tensions)


# ── Pacing ─────────────────────────────────────────────────

def test_pacing_flatline():
    tensions = [3, 3, 3, 3, 5, 7, 8]
    result = analyze_pacing(tensions)
    assert len(result["flatlines"]) > 0
    assert result["flatlines"][0]["length"] >= 3


def test_pacing_whiplash():
    tensions = [2, 8, 3, 9]
    result = analyze_pacing(tensions)
    assert len(result["whiplash"]) > 0


def test_pacing_velocity():
    tensions = [3, 5, 4, 7]
    result = analyze_pacing(tensions)
    assert len(result["velocity"]) == 3
    assert result["velocity"][0]["label"] == "rising"


def test_pacing_breathing_room_present():
    tensions = [3, 4, 8, 3, 5]
    result = analyze_pacing(tensions)
    # Peak at index 2 (value 8), followed by valley 3 at index 3
    br = [b for b in result["breathing_room"] if b["peak_scene"] == 2]
    assert len(br) == 1
    assert br[0]["has_relief"] is True


def test_pacing_breathing_room_absent():
    tensions = [3, 4, 8, 7, 6]
    result = analyze_pacing(tensions)
    br = [b for b in result["breathing_room"] if b["peak_scene"] == 2]
    assert len(br) == 1
    assert br[0]["has_relief"] is False


def test_pacing_empty():
    result = analyze_pacing([])
    assert result["velocity"] == []


def test_pacing_single():
    result = analyze_pacing([5])
    assert result["velocity"] == []


# ── Presence ───────────────────────────────────────────────

def test_presence_basic():
    scenes = [
        {"pov": "Alice", "title": "Scene 1", "summary": ""},
        {"pov": "Bob", "title": "Scene 2", "summary": "Alice watches"},
        {"pov": "Alice", "title": "Scene 3", "summary": ""},
    ]
    characters = [{"name": "Alice"}, {"name": "Bob"}]
    result = compute_presence(scenes, characters)
    assert len(result["matrix"]) == 2
    assert len(result["matrix"][0]) == 3
    # Alice: POV in scene 0 and 2, mentioned in scene 1
    assert result["matrix"][0][0] == 2  # POV
    assert result["matrix"][0][1] == 1  # mentioned in summary
    assert result["matrix"][0][2] == 2  # POV


def test_presence_stats():
    scenes = [
        {"pov": "Alice", "title": "S1", "summary": ""},
        {"pov": "Bob", "title": "S2", "summary": ""},
        {"pov": "Alice", "title": "S3", "summary": ""},
    ]
    characters = [{"name": "Alice"}, {"name": "Bob"}]
    result = compute_presence(scenes, characters)
    alice_stats = result["stats"][0]
    assert alice_stats["pov_count"] == 2
    assert alice_stats["coverage"] > 0


def test_presence_empty():
    result = compute_presence([], [])
    assert result["matrix"] == []


# ── Character Arcs ─────────────────────────────────────────

def test_arc_basic():
    tensions = [3, 5, 7, 4, 8]
    presence = [True, True, True, True, True]
    result = compute_character_arc(tensions, presence)
    assert "arc_shape" in result
    assert result["arc_shape"] in ("rise", "fall", "rise-fall", "fall-rise", "flat", "wave")


def test_arc_partial_presence():
    tensions = [3, 5, 7, 4, 8, 6, 9]
    presence = [True, False, True, False, True, False, True]
    result = compute_character_arc(tensions, presence)
    assert len(result["points"]) == 4  # only present scenes


def test_arc_empty():
    result = compute_character_arc([], [])
    assert result["arc_shape"] == "flat"


# ── Health Score ───────────────────────────────────────────

def test_health_score():
    result = compute_health(
        scenes=[{"tension": 5, "pov": "A", "act": 1}] * 10,
        characters=[{"name": "A"}],
        edges=[],
        insights=[],
        word_count=5000,
        target_words=80000,
    )
    assert 0 <= result["score"] <= 100
    assert result["grade"] in ("A", "B", "C", "D", "F")


def test_health_all_components():
    result = compute_health(
        scenes=[
            {"tension": 3, "pov": "A", "act": 1},
            {"tension": 5, "pov": "B", "act": 1},
            {"tension": 7, "pov": "A", "act": 2},
            {"tension": 8, "pov": "B", "act": 2},
            {"tension": 4, "pov": "A", "act": 3},
            {"tension": 9, "pov": "B", "act": 3},
        ],
        characters=[{"name": "A"}, {"name": "B"}],
        edges=[{"id": "1"}],
        insights=[{"dismissed": True}],
        word_count=80000,
        target_words=80000,
    )
    assert result["score"] > 50
    comps = result["components"]
    assert comps["completion"] == 100.0
    assert "pacing" in comps
    assert "character_coverage" in comps


def test_health_empty():
    result = compute_health(
        scenes=[], characters=[], edges=[], insights=[],
        word_count=0, target_words=80000,
    )
    assert result["grade"] == "F"


# ── Sparkline ──────────────────────────────────────────────

def test_sparkline():
    tensions = list(range(1, 41))
    result = tension_sparkline(tensions, target_points=12)
    assert len(result) == 12


def test_sparkline_short():
    tensions = [3, 5, 7]
    result = tension_sparkline(tensions, target_points=12)
    assert len(result) == 12


def test_sparkline_empty():
    result = tension_sparkline([], target_points=12)
    assert len(result) == 12
    assert all(v == 0.0 for v in result)


def test_sparkline_preserves_extremes():
    tensions = [1, 1, 1, 10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    result = tension_sparkline(tensions, target_points=8)
    assert max(result) >= 8  # LTTB should preserve the spike
