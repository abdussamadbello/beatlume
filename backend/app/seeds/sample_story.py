"""Seed script: creates sample user, org, story, scenes, characters, drafts, insights.

Usage:
    cd backend && PYTHONPATH=. uv run python -m app.seeds.sample_story

Idempotent — skips creation if the user already exists.
"""

import uuid

import bcrypt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import Base
from app.models.character import Character
from app.models.core import CoreConfigNode, CoreKind, CoreSetting
from app.models.draft import DraftContent
from app.models.insight import Insight, InsightSeverity
from app.models.manuscript import ManuscriptChapter
from app.models.scene import Scene
from app.models.story import Story, StoryStatus
from app.models.user import Membership, MembershipRole, Organization, User
from app.services.core import populate_default_core_sync

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------
engine = create_engine(settings.database_url_sync, echo=False)


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
SCENES = [
    {"n": 1, "title": "Orchard at dawn", "pov": "Iris", "tension": 3, "act": 1, "location": "Orchard", "tag": "Setup"},
    {"n": 2, "title": "The letter from Col.", "pov": "Iris", "tension": 5, "act": 1, "location": "Kitchen", "tag": "Inciting"},
    {"n": 3, "title": "Wren returns uninvited", "pov": "Iris", "tension": 6, "act": 1, "location": "Porch", "tag": "Conflict"},
    {"n": 4, "title": "Mara dismisses the rumor", "pov": "Iris", "tension": 4, "act": 1, "location": "Barn", "tag": "Quiet"},
    {"n": 5, "title": "Jon watches from the ridge", "pov": "Jon", "tension": 5, "act": 2, "location": "Ridge", "tag": "Shift"},
    {"n": 6, "title": "Kai's warning", "pov": "Iris", "tension": 7, "act": 2, "location": "Cellar", "tag": "Escalation"},
    {"n": 7, "title": "Fen lies to Doc", "pov": "Fen", "tension": 6, "act": 2, "location": "Clinic", "tag": "Deception"},
    {"n": 8, "title": "Night — the first fire", "pov": "Iris", "tension": 9, "act": 2, "location": "Orchard", "tag": "Turn"},
    {"n": 9, "title": "Morning ashes", "pov": "Iris", "tension": 6, "act": 2, "location": "Orchard", "tag": "Aftermath"},
    {"n": 10, "title": "Cole at the court", "pov": "Cole", "tension": 5, "act": 2, "location": "Court", "tag": "Subplot"},
    {"n": 11, "title": "Root cellar", "pov": "Iris", "tension": 8, "act": 2, "location": "Cellar", "tag": "Escalation"},
    {"n": 12, "title": "Confession", "pov": "Iris", "tension": 10, "act": 3, "location": "Kitchen", "tag": "Climax"},
    {"n": 13, "title": "The orchard emptied", "pov": "Iris", "tension": 5, "act": 3, "location": "Orchard", "tag": "Resolution"},
]

CHARACTERS = [
    {
        "name": "Iris",
        "role": "Protagonist",
        "description": "A widow returning to her family's failing orchard.",
        "bio": (
            "Iris Holloway is thirty-eight, recently widowed, and the last Holloway still answering to that name. "
            "She left the orchard at nineteen and built a life in the city as a botanical illustrator. When her mother dies, "
            "she returns to find the trees diseased, the books mortgaged, and a stranger asking too many questions about her sister."
        ),
        "desire": "Save the orchard and preserve her family legacy",
        "flaw": "Cannot let go of the past",
        "scene_count": 40, "longest_gap": 0,
    },
    {
        "name": "Wren",
        "role": "Foil",
        "description": "Iris's estranged half-brother, returning after twenty years.",
        "bio": (
            "Wren disappeared the summer their father died and surfaces now driving a borrowed truck and carrying a debt no one will name. "
            "He works the harvest beside Iris with the easy competence of someone who never wanted to leave, and the watchfulness of someone who knows why he had to."
        ),
        "desire": "Redemption for abandoning the family",
        "flaw": "Avoids confrontation until it is too late",
        "scene_count": 24, "longest_gap": 3,
    },
    {
        "name": "Cole",
        "role": "Antagonist",
        "description": "A neighboring landowner with plans for the valley.",
        "bio": (
            "Cole Maddox runs the largest commercial orchard in the county and has spent a decade quietly buying out the smaller ones. "
            "He believes Iris's grief is a temporary obstacle and her land is already, in every way that matters, his."
        ),
        "desire": "Control the land and its future",
        "flaw": "Believes ownership equals power",
        "scene_count": 22, "longest_gap": 5,
    },
    {
        "name": "Jon",
        "role": "Mirror",
        "description": "A field hand who has worked the orchard since childhood.",
        "bio": (
            "Jon grew up in the cottage at the edge of the property and stayed on after Iris's mother died, paid in room and board and silence. "
            "He sees everything that happens at the orchard and reports almost none of it."
        ),
        "desire": "Understand his own place in the valley",
        "flaw": "Watches instead of acting",
        "scene_count": 18, "longest_gap": 4,
    },
    {
        "name": "Mara",
        "role": "Family",
        "description": "Iris's aunt; the one who stayed.",
        "bio": (
            "Mara raised Iris's sister after the accident and has run the orchard accounts ever since. "
            "She loves Iris with a fierce, conditional clarity and has been waiting two decades to tell her exactly one thing."
        ),
        "desire": "Protect Iris from the truth",
        "flaw": "Keeps secrets that corrode trust",
        "scene_count": 12, "longest_gap": 9,
    },
    {
        "name": "Kai",
        "role": "Mentor",
        "description": "A retired arborist and old friend of Iris's father.",
        "bio": (
            "Kai diagnosed the blight in the orchard's heritage trees three years before anyone else would listen. "
            "He keeps a notebook of everything he failed to save and offers Iris counsel only when she stops asking for it."
        ),
        "desire": "Guide Iris without imposing his will",
        "flaw": "Carries guilt from a past failure",
        "scene_count": 9, "longest_gap": 8,
    },
    {
        "name": "Fen",
        "role": "Ward",
        "description": "A teenage runaway Iris finds sleeping in the barn.",
        "bio": (
            "Fen is sixteen, evasive about everything, and useful with a ladder. "
            "Iris cannot tell whether the boy is hiding from the law, from family, or from something he saw at Cole's place."
        ),
        "desire": "Escape the valley and start fresh",
        "flaw": "Lies reflexively when cornered",
        "scene_count": 8, "longest_gap": 12,
    },
    {
        "name": "Doc",
        "role": "Witness",
        "description": "The county's part-time medical examiner and full-time historian.",
        "bio": (
            "Doc kept the records on every accident and unexplained death in the valley for forty years. "
            "He is the only person left who remembers the night Iris's sister disappeared, and the only one with the paperwork to prove it."
        ),
        "desire": "Record the truth before it vanishes",
        "flaw": "Trusts paper more than people",
        "scene_count": 6, "longest_gap": 15,
    },
    {
        "name": "Sib",
        "role": "Pawn",
        "description": "Cole's bookkeeper; soft-spoken and exhaustively loyal.",
        "bio": (
            "Sib has worked for Cole since she was twenty-two and has never once asked what the off-ledger payments were for. "
            "Her loyalty is mistaken by everyone, including herself, for character."
        ),
        "desire": "Please whoever holds power",
        "flaw": "Cannot distinguish loyalty from submission",
        "scene_count": 6, "longest_gap": 11,
    },
    {
        "name": "Old Man",
        "role": "Ghost",
        "description": "Iris's late father, present in memory and letters.",
        "bio": (
            "Henry Holloway built the orchard with his own hands and lost it slowly, in transactions he never explained to his daughters. "
            "His handwriting appears throughout the story in margins, ledgers, and a final letter Iris finds three months too late."
        ),
        "desire": "Be remembered as he was, not as he became",
        "flaw": "Left no instructions for the living",
        "scene_count": 4, "longest_gap": 18,
    },
]

PROSE: dict[int, str] = {
    1: (
        "There was a time, Iris thought, when the orchard had belonged to nobody in particular and therefore to her. "
        "Her father had walked it that way; her mother, at the end, had spoken of it that way, in the long slow sentences the morphine had given her. "
        "Now the orchard was a matter of paper, and the paper was in a drawer in Helena, and the paper had begun, quietly, to write itself.\n\n"
        "She was forty-three the morning the letter came. The woman from the rural route left it in the box with a catalogue and a flyer for a new church, "
        "as if the three things were all of one weight. Iris read it standing in the gravel, in the wind that always came off the foothills at that hour, "
        "and when she had finished reading it she read it again, because she had understood it perfectly the first time and wanted the sentence to be the other kind of sentence instead.\n\n"
        "The orchard, the letter said, would be sold. There was a buyer. The buyer was patient but not, in the lawyer's phrasing, infinitely patient. "
        "There was a date. The date was in April.\n\n"
        "Iris folded the letter along the seam the envelope had given it, put it in the pocket of her apron, and walked into the trees."
    ),
    2: (
        'The porch boards complained under his boots before she saw him, which meant she had ten seconds to pretend the letter had never come. '
        "Iris folded it twice along a seam already tired from folding, slid it into the pocket of her apron, and wiped her hands on the same apron "
        "as if flour, not paper, were the thing she needed to get rid of.\n\n"
        '"You\'re early," she said, without turning.\n\n'
        '"I\'m not early, Iris. You\'ve just been expecting me for eleven years."'
    ),
    3: (
        "They laid them on the kitchen table in the order Wren's mother had kept them, which was no order at all. "
        "Iris sorted them by postmark while Wren made coffee the way her mother used to make it, one heaping spoon and a pinch of salt, "
        "as if he had never left the house.\n\n"
        "The earliest letter was from August. The most recent had been written nine days ago. She read them in sequence. "
        "The lawyer's sentences tightened as they went; by the tenth letter the word options had disappeared and the word deadline had moved to the first paragraph."
    ),
    4: (
        "Kai had always known when to keep his distance and when the distance itself became the tell. "
        "Tonight he stood close enough that Iris could smell the cellar on him — the old apples, the kerosene, "
        "the cold-stone smell that the house carried in its bones no matter what season pretended to run above it.\n\n"
        '"Your sister wrote to me," he said.\n\n'
        '"My sister is dead, Kai."\n\n'
        '"Yes," he said, "but she wrote to me after."'
    ),
    5: (
        "She read it twice before she let herself understand it, and then a third time to be sure the understanding was not a wish. "
        "Mara had written in the voice she used for hard things, which was the voice of someone else — a lawyer, a priest, a woman on the radio. "
        "The handwriting was Mara's. The sentences were not.\n\n"
        "If you are reading this, the letter began, then I have given the orchard away by mistake, and you will need to take it back."
    ),
    6: (
        "Kai met her at the cellar door with a lantern already lit. The steps were damp, the air smelled of kerosene and cold stone. "
        "He told her what he had found buried beneath the oldest shelf — a letter in handwriting she recognized."
    ),
    7: (
        "Fen sat across from Doc and lied with the ease of a man who had practiced on himself first. "
        "The clinic was too bright, the questions too careful. He answered every one and meant none of them."
    ),
    8: (
        "The fire came from the north field at an hour when no one should have been awake to see it. "
        "Iris ran toward the smoke with nothing but a shovel and a half-formed prayer. "
        "By the time Jon arrived, two rows of apple trees were already gone."
    ),
    9: (
        "Morning revealed what the dark had tried to hide. Ash covered the north field in a thin, even layer, "
        "as if the fire had been careful. Iris walked the rows counting what remained and trying not to count what did not."
    ),
    10: (
        "Cole arrived at the county court in a suit that still smelled of the city. "
        "He carried a folder thick with documents and a confidence that came from having read every one of them. "
        "The clerk looked up and recognized trouble."
    ),
    11: (
        "The root cellar was colder than Iris remembered, or perhaps she had simply forgotten how cold truth could feel. "
        "The box Kai had found was small, wooden, and sealed with wax that crumbled at her touch. "
        "Inside were three photographs and a deed she had never seen."
    ),
    12: (
        "Iris set the deed on the kitchen table between them and waited. Cole looked at it the way a man looks at a door "
        "he thought he had locked. The silence lasted long enough for the kettle to boil, and then he told her everything."
    ),
    13: (
        "The orchard stood empty in the late afternoon light, its remaining trees casting long shadows across the cleared ground. "
        "Iris walked the boundary one last time, touching each fence post as she passed. "
        "Some things, she decided, were better held loosely."
    ),
}

CORE_NODES: list[dict] = [
    {"depth": 0, "label": "A Stranger in the Orchard", "kind": CoreKind.story, "active": True},
    {"depth": 1, "label": "Part One \u2014 Roots", "kind": CoreKind.part, "active": False},
    {"depth": 2, "label": "Ch 1 \u2014 The Orchard at First Light", "kind": CoreKind.chap, "active": False},
    {"depth": 3, "label": "S01 \u2014 Orchard at dawn", "kind": CoreKind.scene, "active": True},
    {"depth": 3, "label": "S02 \u2014 The letter from Col.", "kind": CoreKind.scene, "active": False},
    {"depth": 2, "label": "Ch 2 \u2014 Wren", "kind": CoreKind.chap, "active": False},
    {"depth": 3, "label": "S03 \u2014 Wren returns uninvited", "kind": CoreKind.scene, "active": False},
    {"depth": 1, "label": "Part Two \u2014 Fire", "kind": CoreKind.part, "active": False},
    {"depth": 2, "label": "Ch 5 \u2014 The Ridge", "kind": CoreKind.chap, "active": False},
    {"depth": 3, "label": "S05 \u2014 Jon watches from the ridge", "kind": CoreKind.scene, "active": False},
    {"depth": 3, "label": "S06 \u2014 Kai's warning", "kind": CoreKind.scene, "active": False},
    {"depth": 1, "label": "Part Three \u2014 Ash", "kind": CoreKind.part, "active": False},
    {"depth": 2, "label": "Ch 12 \u2014 Confession", "kind": CoreKind.chap, "active": False},
]

CORE_SETTINGS: list[dict] = [
    {"key": "Title", "value": "A Stranger in the Orchard", "source": "user", "tag": None},
    {"key": "Author", "value": "Elena Marsh", "source": "user", "tag": None},
    {"key": "Genre", "value": "Literary fiction", "source": "user", "tag": "primary"},
    {"key": "POV", "value": "Third-person limited", "source": "user", "tag": None},
    {"key": "Tense", "value": "Past", "source": "user", "tag": None},
    {"key": "Draft", "value": "3", "source": "system", "tag": None},
    {"key": "Word count", "value": "72,340", "source": "system", "tag": None},
    {"key": "Scene count", "value": "47", "source": "system", "tag": None},
    {"key": "Chapter count", "value": "18", "source": "system", "tag": None},
    {"key": "Act structure", "value": "3-act", "source": "user", "tag": None},
    {"key": "Time span", "value": "14 months", "source": "AI", "tag": "inferred"},
    {"key": "Primary location", "value": "Montana orchard", "source": "AI", "tag": "inferred"},
    {"key": "Protagonist", "value": "Iris", "source": "AI", "tag": "inferred"},
    {"key": "Central conflict", "value": "Land ownership vs. family loyalty", "source": "AI", "tag": "inferred"},
]


# Per-node overrides: key is the node's label, value is a list of settings that
# override the story-level defaults for that specific node (and, by inheritance,
# all its descendants until another override overrides it).
CORE_OVERRIDES: dict[str, list[dict]] = {
    "Ch 2 \u2014 Wren": [
        # This chapter tightens the POV close to Wren and shifts the location.
        {"key": "POV", "value": "Third-person close (Wren)", "source": "user", "tag": None},
        {"key": "Primary location", "value": "Kitchen, Orchard house", "source": "AI", "tag": "inferred"},
    ],
    "Ch 5 \u2014 The Ridge": [
        # POV shift to Jon for the ridge sequence.
        {"key": "POV", "value": "Third-person close (Jon)", "source": "user", "tag": None},
        {"key": "Primary location", "value": "North ridge", "source": "AI", "tag": "inferred"},
    ],
    "S05 \u2014 Jon watches from the ridge": [
        # One-scene tense experiment — the ridge scene plays in present tense.
        {"key": "Tense", "value": "Present", "source": "user", "tag": None},
    ],
    "Ch 12 \u2014 Confession": [
        {"key": "Primary location", "value": "Kitchen, Orchard house", "source": "AI", "tag": "inferred"},
    ],
}

CHAPTERS: list[dict] = [
    {
        "num": 1,
        "title": "The Letter",
        "scenes": [1, 2],
    },
    {
        "num": 2,
        "title": "The Return",
        "scenes": [3, 4],
    },
    {
        "num": 3,
        "title": "Whispers on the Ridge",
        "scenes": [5, 6],
    },
    {
        "num": 4,
        "title": "A Lie Well Told",
        "scenes": [7],
    },
    {
        "num": 5,
        "title": "Fire and Ash",
        "scenes": [8, 9],
    },
    {
        "num": 6,
        "title": "The Court",
        "scenes": [10],
    },
    {
        "num": 7,
        "title": "The Deed",
        "scenes": [11],
    },
    {
        "num": 8,
        "title": "Confession",
        "scenes": [12],
    },
    {
        "num": 9,
        "title": "The Orchard Emptied",
        "scenes": [13],
    },
]


INSIGHTS = [
    {
        "severity": InsightSeverity.red,
        "category": "Continuity",
        "title": "Mara referenced after death without setup",
        "body": "Mara is mentioned in S23 as having written a letter, but her death is not established until S19. Readers may be confused by the chronology.",
        "refs": ["S19", "S23"],
    },
    {
        "severity": InsightSeverity.red,
        "category": "Pacing",
        "title": "Act II sag — tension drops below 4 for 5 consecutive scenes",
        "body": "Between S14 and S18 the tension stays at 3-4. Consider cutting one quiet scene or adding a subplot beat to maintain momentum.",
        "refs": ["S14", "S15", "S16", "S17", "S18"],
    },
    {
        "severity": InsightSeverity.red,
        "category": "Character",
        "title": "Cole's motivation unclear in Act III",
        "body": "Cole's desire to control the land is established in Act I but receives no development in Act III. Consider adding a beat that shows what he stands to gain or lose.",
        "refs": ["S34", "S38", "S42"],
    },
    {
        "severity": InsightSeverity.amber,
        "category": "Character",
        "title": "Fen disappears for 12 scenes",
        "body": "Fen last appears in S7 and does not return until S19. This is the longest character gap in the manuscript. Consider a brief mention or interstitial.",
        "refs": ["S7", "S19"],
    },
    {
        "severity": InsightSeverity.blue,
        "category": "Symbol",
        "title": "Orchard motif carries well across all three acts",
        "body": "The orchard appears in 14 scenes across all acts, serving as the primary symbolic throughline. Strong thematic cohesion.",
        "refs": ["S1", "S8", "S13", "S22", "S47"],
    },
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def _seed_manuscript(db: Session, story: Story) -> None:
    """Insert manuscript chapters assembled from seeded scene prose.

    Idempotent — skips chapters that already exist for the story.
    """
    existing_nums = {
        row[0]
        for row in db.execute(
            select(ManuscriptChapter.num).where(ManuscriptChapter.story_id == story.id)
        ).all()
    }
    if len(existing_nums) >= len(CHAPTERS):
        return

    for i, ch in enumerate(CHAPTERS):
        if ch["num"] in existing_nums:
            continue
        body = "\n\n".join(PROSE[n] for n in ch["scenes"] if n in PROSE)
        db.add(
            ManuscriptChapter(
                id=uuid.uuid4(),
                org_id=story.org_id,
                story_id=story.id,
                num=ch["num"],
                title=ch["title"],
                content=body,
                sort_order=i,
            )
        )


def _seed_core(db: Session, story: Story) -> None:
    """Insert the rich sample narrative-core tree + settings if not present.

    Idempotent — checks existence per row so the seed can be re-run to
    backfill data on already-seeded databases.
    """
    existing_node_count = db.execute(
        select(Story).where(Story.id == story.id)
    ).scalar_one_or_none()
    if existing_node_count is None:
        return

    has_any_node = db.execute(
        select(CoreConfigNode).where(CoreConfigNode.story_id == story.id).limit(1)
    ).scalar_one_or_none()
    if has_any_node is None:
        # Track the most recent node at each depth so we can assign parent_id
        # without relying on a post-hoc backfill query.
        depth_stack: dict[int, uuid.UUID] = {}
        for i, n in enumerate(CORE_NODES):
            node_id = uuid.uuid4()
            parent_id = depth_stack.get(n["depth"] - 1)
            db.add(
                CoreConfigNode(
                    id=node_id,
                    org_id=story.org_id,
                    story_id=story.id,
                    parent_id=parent_id,
                    depth=n["depth"],
                    label=n["label"],
                    kind=n["kind"],
                    active=n.get("active", False),
                    sort_order=i,
                )
            )
            depth_stack[n["depth"]] = node_id
            # Any stale entries for deeper levels are no longer valid parents
            # for later nodes, so forget them.
            for d in list(depth_stack.keys()):
                if d > n["depth"]:
                    del depth_stack[d]
        db.flush()

    # Story-level defaults (config_node_id IS NULL)
    existing_root_keys = {
        row[0]
        for row in db.execute(
            select(CoreSetting.key).where(
                CoreSetting.story_id == story.id, CoreSetting.config_node_id.is_(None)
            )
        ).all()
    }
    for s in CORE_SETTINGS:
        if s["key"] in existing_root_keys:
            continue
        db.add(
            CoreSetting(
                id=uuid.uuid4(),
                org_id=story.org_id,
                story_id=story.id,
                config_node_id=None,
                key=s["key"],
                value=s["value"],
                source=s["source"],
                tag=s["tag"],
            )
        )
    db.flush()

    # Per-node overrides
    if CORE_OVERRIDES:
        nodes_by_label = {
            n.label: n
            for n in db.execute(
                select(CoreConfigNode).where(CoreConfigNode.story_id == story.id)
            )
            .scalars()
            .all()
        }
        for label, overrides in CORE_OVERRIDES.items():
            node = nodes_by_label.get(label)
            if node is None:
                continue
            existing_node_keys = {
                row[0]
                for row in db.execute(
                    select(CoreSetting.key).where(
                        CoreSetting.story_id == story.id,
                        CoreSetting.config_node_id == node.id,
                    )
                ).all()
            }
            for s in overrides:
                if s["key"] in existing_node_keys:
                    continue
                db.add(
                    CoreSetting(
                        id=uuid.uuid4(),
                        org_id=story.org_id,
                        story_id=story.id,
                        config_node_id=node.id,
                        key=s["key"],
                        value=s["value"],
                        source=s["source"],
                        tag=s["tag"],
                    )
                )


def seed() -> None:
    with Session(engine) as db:
        existing_user = db.execute(
            select(User).where(User.email == "elena@beatlume.io")
        ).scalar_one_or_none()
        if existing_user is not None:
            existing_story = db.execute(
                select(Story).where(Story.org_id == existing_user.active_org_id)
            ).scalar_one_or_none()
            if existing_story is not None:
                _seed_core(db, existing_story)
                _seed_manuscript(db, existing_story)
                db.commit()
                print(
                    "Seed data already exists (elena@beatlume.io found). "
                    "Backfilled narrative-core nodes/settings and manuscript chapters if missing."
                )
            else:
                print("Seed data already exists (elena@beatlume.io found). Skipping.")
            return

        # 1. Organization
        org = Organization(
            id=uuid.uuid4(),
            name="Elena's Workspace",
            slug="elena-workspace",
        )
        db.add(org)
        db.flush()

        # 2. User
        user = User(
            id=uuid.uuid4(),
            email="elena@beatlume.io",
            name="Elena Marsh",
            password_hash=_hash("beatlume123"),
            plan="pro",
            active_org_id=org.id,
        )
        db.add(user)
        db.flush()

        # 3. Membership
        membership = Membership(
            id=uuid.uuid4(),
            user_id=user.id,
            org_id=org.id,
            role=MembershipRole.owner,
        )
        db.add(membership)
        db.flush()

        # 4. Story
        story = Story(
            id=uuid.uuid4(),
            org_id=org.id,
            title="A Stranger in the Orchard",
            genres=["Literary", "Mystery"],
            target_words=90000,
            draft_number=3,
            status=StoryStatus.in_progress,
            structure_type="3-act",
        )
        db.add(story)
        db.flush()

        # 5. Scenes
        scene_objects: dict[int, Scene] = {}
        for s in SCENES:
            scene = Scene(
                id=uuid.uuid4(),
                org_id=org.id,
                story_id=story.id,
                n=s["n"],
                title=s["title"],
                pov=s["pov"],
                tension=s["tension"],
                act=s["act"],
                location=s["location"],
                tag=s["tag"],
                summary=s.get("summary") or s["title"],
            )
            db.add(scene)
            scene_objects[s["n"]] = scene
        db.flush()

        # 6. Characters
        for c in CHARACTERS:
            char = Character(
                id=uuid.uuid4(),
                org_id=org.id,
                story_id=story.id,
                name=c["name"],
                role=c["role"],
                description=c.get("description", ""),
                bio=c.get("bio", ""),
                desire=c["desire"],
                flaw=c["flaw"],
                scene_count=c["scene_count"],
                longest_gap=c["longest_gap"],
            )
            db.add(char)
        db.flush()

        # 7. Draft content (all 13 scenes)
        for n, prose in PROSE.items():
            scene = scene_objects[n]
            draft = DraftContent(
                id=uuid.uuid4(),
                org_id=org.id,
                story_id=story.id,
                scene_id=scene.id,
                content=prose,
                word_count=len(prose.split()),
            )
            db.add(draft)
        db.flush()

        # 8. Narrative core (config tree + settings)
        _seed_core(db, story)

        # 9. Manuscript chapters (assembled from scene prose)
        _seed_manuscript(db, story)

        # 10. Insights
        for ins in INSIGHTS:
            insight = Insight(
                id=uuid.uuid4(),
                org_id=org.id,
                story_id=story.id,
                severity=ins["severity"],
                category=ins["category"],
                title=ins["title"],
                body=ins["body"],
                refs=ins["refs"],
                dismissed=False,
            )
            db.add(insight)

        db.commit()
        print(f"Seed data created successfully.")
        print(f"  User:  elena@beatlume.io / beatlume123")
        print(f"  Org:   {org.id}")
        print(f"  Story: {story.id} — A Stranger in the Orchard")
        print(f"  Scenes: {len(SCENES)}, Characters: {len(CHARACTERS)}")
        print(f"  Draft content: {len(PROSE)} scenes with prose")
        print(f"  Core nodes: {len(CORE_NODES)}, Core settings: {len(CORE_SETTINGS)}")
        print(f"  Manuscript chapters: {len(CHAPTERS)}")
        print(f"  Insights: {len(INSIGHTS)}")


if __name__ == "__main__":
    seed()
