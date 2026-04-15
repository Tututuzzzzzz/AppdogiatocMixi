from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING

from app.models.activity import ACTIVITY_COLLECTION
from app.models.user import USER_COLLECTION


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[USER_COLLECTION].create_index("email", unique=True, name="uq_user_email")

    await db[ACTIVITY_COLLECTION].create_index(
        [("user_id", ASCENDING), ("timestamp", ASCENDING)],
        name="idx_activity_user_timestamp",
    )
    await db[ACTIVITY_COLLECTION].create_index(
        [("user_id", ASCENDING), ("activity", ASCENDING)],
        name="idx_activity_user_activity",
    )
