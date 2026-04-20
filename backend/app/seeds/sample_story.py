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
from app.models.draft import DraftContent
from app.models.insight import Insight, InsightSeverity
from app.models.scene import Scene
from app.models.story import Story, StoryStatus
from app.models.user import Membership, MembershipRole, Organization, User

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
    {"name": "Iris", "role": "Protagonist", "desire": "Save the orchard and preserve her family legacy", "flaw": "Cannot let go of the past", "scene_count": 40, "longest_gap": 0},
    {"name": "Wren", "role": "Foil", "desire": "Redemption for abandoning the family", "flaw": "Avoids confrontation until it is too late", "scene_count": 24, "longest_gap": 3},
    {"name": "Cole", "role": "Antagonist", "desire": "Control the land and its future", "flaw": "Believes ownership equals power", "scene_count": 22, "longest_gap": 5},
    {"name": "Jon", "role": "Mirror", "desire": "Understand his own place in the valley", "flaw": "Watches instead of acting", "scene_count": 18, "longest_gap": 4},
    {"name": "Mara", "role": "Family", "desire": "Protect Iris from the truth", "flaw": "Keeps secrets that corrode trust", "scene_count": 12, "longest_gap": 9},
    {"name": "Kai", "role": "Mentor", "desire": "Guide Iris without imposing his will", "flaw": "Carries guilt from a past failure", "scene_count": 9, "longest_gap": 8},
    {"name": "Fen", "role": "Ward", "desire": "Escape the valley and start fresh", "flaw": "Lies reflexively when cornered", "scene_count": 8, "longest_gap": 12},
    {"name": "Doc", "role": "Witness", "desire": "Record the truth before it vanishes", "flaw": "Trusts paper more than people", "scene_count": 6, "longest_gap": 15},
    {"name": "Sib", "role": "Pawn", "desire": "Please whoever holds power", "flaw": "Cannot distinguish loyalty from submission", "scene_count": 6, "longest_gap": 11},
    {"name": "Old Man", "role": "Ghost", "desire": "Be remembered as he was, not as he became", "flaw": "Left no instructions for the living", "scene_count": 4, "longest_gap": 18},
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
def seed() -> None:
    with Session(engine) as db:
        # Check idempotency
        existing = db.execute(
            select(User).where(User.email == "elena@beatlume.io")
        ).scalar_one_or_none()
        if existing is not None:
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

        # 8. Insights
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
        print(f"  Insights: {len(INSIGHTS)}")


if __name__ == "__main__":
    seed()
