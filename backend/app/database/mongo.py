from __future__ import annotations

import logging

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


logger = logging.getLogger(__name__)

mongo_client: AsyncIOMotorClient | None = None
mongo_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global mongo_client, mongo_db

    if mongo_client is not None and mongo_db is not None:
        return

    mongo_client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo_db = mongo_client[settings.mongodb_db_name]

    await mongo_db.command("ping")
    logger.info("Connected to MongoDB database '%s'", settings.mongodb_db_name)


async def close_mongo_connection() -> None:
    global mongo_client, mongo_db

    if mongo_client is not None:
        mongo_client.close()

    mongo_client = None
    mongo_db = None
    logger.info("Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available.",
        )

    return mongo_db


def get_database_instance() -> AsyncIOMotorDatabase:
    if mongo_db is None:
        raise RuntimeError("MongoDB is not connected.")

    return mongo_db
