from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.security import get_password_hash
from app.models.user import USER_COLLECTION
from app.schemas.user import UserRead


def parse_user_id(user_id: str) -> ObjectId:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="userId is invalid.",
        )

    return ObjectId(user_id)


def user_doc_to_schema(user_doc: dict) -> UserRead:
    return UserRead(
        id=str(user_doc["_id"]),
        email=user_doc["email"],
        full_name=user_doc.get("full_name"),
        is_active=user_doc.get("is_active", True),
        created_at=user_doc["created_at"],
    )


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> dict | None:
    normalized_email = email.strip().lower()
    return await db[USER_COLLECTION].find_one({"email": normalized_email})


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> dict | None:
    if not ObjectId.is_valid(user_id):
        return None

    return await db[USER_COLLECTION].find_one({"_id": ObjectId(user_id)})


async def get_user_or_404(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    user_doc = await get_user_by_id(db, user_id)

    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user_doc


async def create_user(
    db: AsyncIOMotorDatabase,
    email: str,
    password: str,
    full_name: str | None,
) -> dict:
    normalized_email = email.strip().lower()

    user_doc = {
        "email": normalized_email,
        "hashed_password": get_password_hash(password),
        "full_name": full_name,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = await db[USER_COLLECTION].insert_one(user_doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        ) from exc

    user_doc["_id"] = result.inserted_id
    return user_doc
