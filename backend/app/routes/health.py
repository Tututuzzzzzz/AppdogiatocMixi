from __future__ import annotations

from fastapi import APIRouter

from app.schemas.common import MessageResponse


router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> MessageResponse:
    return MessageResponse(message="ok")
