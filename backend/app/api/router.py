from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.stories import router as stories_router
from app.api.scenes import router as scenes_router
from app.api.beats import router as beats_router
from app.api.characters import router as characters_router
from app.api.graph import router as graph_router
from app.api.insights import router as insights_router
from app.api.draft import router as draft_router
from app.api.core import router as core_router
from app.api.manuscript import router as manuscript_router
from app.api.collaboration import router as collaboration_router
from app.api.sse import router as sse_router
from app.api.ai import router as ai_router
from app.api.analytics import router as analytics_router
from app.api.export import router as export_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(stories_router)
api_router.include_router(scenes_router)
api_router.include_router(beats_router)
api_router.include_router(characters_router)
api_router.include_router(graph_router)
api_router.include_router(insights_router)
api_router.include_router(draft_router)
api_router.include_router(core_router)
api_router.include_router(manuscript_router)
api_router.include_router(collaboration_router)
api_router.include_router(sse_router)
api_router.include_router(ai_router)
api_router.include_router(analytics_router)
api_router.include_router(export_router)
