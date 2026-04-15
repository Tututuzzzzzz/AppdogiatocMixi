from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongo import get_database
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.auth_service import authenticate_user, build_token_response
from app.services.user_service import create_user, get_user_by_email


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> TokenResponse:
    existing_user = await get_user_by_email(db, payload.email)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    user_doc = await create_user(
        db=db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )

    return build_token_response(user_doc)


@router.post("/login")
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
) -> TokenResponse:
    user_doc = await authenticate_user(db, payload.email, payload.password)

    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return build_token_response(user_doc)
