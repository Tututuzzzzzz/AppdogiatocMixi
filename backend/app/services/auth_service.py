from __future__ import annotations

from fastapi import Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token_subject,
    oauth2_scheme,
    verify_password,
)
from app.database.mongo import get_database
from app.schemas.auth import TokenResponse
from app.services.user_service import get_user_by_email, get_user_by_id, user_doc_to_schema


async def authenticate_user(
    db: AsyncIOMotorDatabase,
    email: str,
    password: str,
) -> dict | None:
    user_doc = await get_user_by_email(db, email)

    if user_doc is None:
        return None

    if not verify_password(password, user_doc["hashed_password"]):
        return None

    return user_doc


def build_token_response(user_doc: dict) -> TokenResponse:
    expires_in_seconds = settings.access_token_expire_minutes * 60
    access_token = create_access_token(
        subject=str(user_doc["_id"]),
        expires_minutes=settings.access_token_expire_minutes,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in_seconds,
        user=user_doc_to_schema(user_doc),
    )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    unauthorized_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    subject = decode_access_token_subject(token)
    if subject is None:
        raise unauthorized_error

    user_doc = await get_user_by_id(db, subject)
    if user_doc is None:
        raise unauthorized_error

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    return user_doc


def ensure_current_user_matches_user_id(current_user: dict, user_id: str) -> None:
    if str(current_user["_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this user data.",
        )
