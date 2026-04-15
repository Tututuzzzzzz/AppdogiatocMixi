from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.user import UserRead
from app.services.auth_service import get_current_user
from app.services.user_service import user_doc_to_schema


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def read_current_user(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserRead:
    return user_doc_to_schema(current_user)
