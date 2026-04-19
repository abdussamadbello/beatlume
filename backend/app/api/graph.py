import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.graph import EdgeCreate, EdgeRead, EdgeUpdate, GraphResponse, NodeRead, NodeUpdate
from app.services import graph as graph_service

router = APIRouter(prefix="/api/stories/{story_id}/graph", tags=["graph"])


@router.get("", response_model=GraphResponse)
async def get_graph(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    nodes, edges = await graph_service.get_graph(db, story.id)
    return GraphResponse(nodes=nodes, edges=edges)


@router.put("/nodes/{node_id}", response_model=NodeRead)
async def update_node(node_id: uuid.UUID, body: NodeUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    node = await graph_service.update_node(db, story.id, node_id, body.model_dump(exclude_unset=True))
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("/edges", response_model=EdgeRead, status_code=status.HTTP_201_CREATED)
async def create_edge(body: EdgeCreate, story: Story = Depends(get_story), org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    edge = await graph_service.create_edge(db, story.id, org.id, body.model_dump())
    return edge


@router.put("/edges/{edge_id}", response_model=EdgeRead)
async def update_edge(edge_id: uuid.UUID, body: EdgeUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    edge = await graph_service.update_edge(db, story.id, edge_id, body.model_dump(exclude_unset=True))
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edge(edge_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    deleted = await graph_service.delete_edge(db, story.id, edge_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Edge not found")
    return None
