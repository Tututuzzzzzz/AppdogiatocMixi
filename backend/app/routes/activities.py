from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongo import get_database
from app.schemas.activity import (
    ActivityCreateRequest,
    ActivityDeleteResponse,
    ActivityHistoryResponse,
    ActivityRead,
    ActivityStatsResponse,
)
from app.services.activity_service import (
    activity_doc_to_schema,
    create_activity_log,
    delete_activity_history,
    get_activity_history,
    get_activity_stats,
)
from app.services.auth_service import get_current_user, ensure_current_user_matches_user_id


router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def post_activity(
    payload: ActivityCreateRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> ActivityRead:
    ensure_current_user_matches_user_id(current_user, payload.user_id)

    activity_doc = await create_activity_log(db, payload)
    return activity_doc_to_schema(activity_doc)


@router.get("/history")
async def activities_history(
    user_id: Annotated[str, Query(alias="userId", min_length=1)],
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    skip: Annotated[int, Query(ge=0)] = 0,
) -> ActivityHistoryResponse:
    ensure_current_user_matches_user_id(current_user, user_id)

    return await get_activity_history(db, user_id=user_id, limit=limit, skip=skip)


@router.delete("/history")
async def delete_activities_history(
    user_id: Annotated[str, Query(alias="userId", min_length=1)],
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    start_timestamp: Annotated[int | None, Query(alias="startTimestamp", ge=0)] = None,
    end_timestamp: Annotated[int | None, Query(alias="endTimestamp", ge=0)] = None,
) -> ActivityDeleteResponse:
    ensure_current_user_matches_user_id(current_user, user_id)

    if start_timestamp is not None and end_timestamp is not None and start_timestamp > end_timestamp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="startTimestamp must be less than or equal to endTimestamp.",
        )

    deleted_count = await delete_activity_history(
        db,
        user_id=user_id,
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
    )
    return ActivityDeleteResponse(deleted_count=deleted_count)


@router.get("/stats")
async def activities_stats(
    user_id: Annotated[str, Query(alias="userId", min_length=1)],
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> ActivityStatsResponse:
    ensure_current_user_matches_user_id(current_user, user_id)

    return await get_activity_stats(db, user_id=user_id)
