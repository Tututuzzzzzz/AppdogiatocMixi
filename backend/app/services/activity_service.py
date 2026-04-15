from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from app.models.activity import ACTIVITY_COLLECTION
from app.schemas.activity import (
    ActivityCreateRequest,
    ActivityHistoryResponse,
    ActivityRead,
    ActivityStatItem,
    ActivityStatsResponse,
)
from app.services.user_service import parse_user_id


def activity_doc_to_schema(activity_doc: dict) -> ActivityRead:
    return ActivityRead(
        id=str(activity_doc["_id"]),
        user_id=str(activity_doc["user_id"]),
        activity=activity_doc["activity"],
        confidence=activity_doc["confidence"],
        timestamp=activity_doc["timestamp"],
        created_at=activity_doc["created_at"],
    )


async def create_activity_log(
    db: AsyncIOMotorDatabase,
    payload: ActivityCreateRequest,
) -> dict:
    user_object_id = parse_user_id(payload.user_id)

    activity_doc = {
        "user_id": user_object_id,
        "activity": payload.activity,
        "confidence": payload.confidence,
        "timestamp": payload.timestamp,
        "created_at": datetime.now(timezone.utc),
    }

    result = await db[ACTIVITY_COLLECTION].insert_one(activity_doc)
    activity_doc["_id"] = result.inserted_id

    return activity_doc


async def get_activity_history(
    db: AsyncIOMotorDatabase,
    user_id: str,
    limit: int,
    skip: int,
) -> ActivityHistoryResponse:
    user_object_id = parse_user_id(user_id)
    filter_query = {"user_id": user_object_id}

    cursor = (
        db[ACTIVITY_COLLECTION]
        .find(filter_query)
        .sort("timestamp", ASCENDING)
        .skip(skip)
        .limit(limit)
    )

    docs = await cursor.to_list(length=limit)
    total = await db[ACTIVITY_COLLECTION].count_documents(filter_query)

    return ActivityHistoryResponse(
        items=[activity_doc_to_schema(doc) for doc in docs],
        total=total,
    )


async def delete_activity_history(
    db: AsyncIOMotorDatabase,
    user_id: str,
    start_timestamp: int | None = None,
    end_timestamp: int | None = None,
) -> int:
    user_object_id = parse_user_id(user_id)

    filter_query: dict[str, object] = {"user_id": user_object_id}
    timestamp_filter: dict[str, int] = {}

    if start_timestamp is not None:
        timestamp_filter["$gte"] = start_timestamp

    if end_timestamp is not None:
        timestamp_filter["$lte"] = end_timestamp

    if timestamp_filter:
        filter_query["timestamp"] = timestamp_filter

    result = await db[ACTIVITY_COLLECTION].delete_many(filter_query)
    return int(result.deleted_count)


async def get_activity_stats(db: AsyncIOMotorDatabase, user_id: str) -> ActivityStatsResponse:
    user_object_id = parse_user_id(user_id)

    docs = await (
        db[ACTIVITY_COLLECTION]
        .find({"user_id": user_object_id})
        .sort("timestamp", ASCENDING)
        .to_list(length=None)
    )

    counts: dict[str, int] = defaultdict(int)
    durations: dict[str, int] = defaultdict(int)

    for index, doc in enumerate(docs):
        activity_name = str(doc["activity"])
        counts[activity_name] += 1

        if index + 1 >= len(docs):
            continue

        next_doc = docs[index + 1]
        current_ts = int(doc.get("timestamp", 0))
        next_ts = int(next_doc.get("timestamp", current_ts))
        delta_ms = max(next_ts - current_ts, 0)

        durations[activity_name] += delta_ms

    activity_items = [
        ActivityStatItem(activity=activity_name, count=count, total_time_ms=durations[activity_name])
        for activity_name, count in counts.items()
    ]
    activity_items.sort(key=lambda item: item.count, reverse=True)

    return ActivityStatsResponse(
        user_id=user_id,
        total_logs=len(docs),
        activities=activity_items,
    )
