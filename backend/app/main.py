from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.database.indexes import ensure_indexes
from app.database.mongo import close_mongo_connection, connect_to_mongo, get_database_instance
from app.routes import activities, auth, health, users
from app.schemas.common import MessageResponse


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    await ensure_indexes(get_database_instance())
    yield
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "message": "Validation error.",
            "errors": exc.errors(),
        },
    )


@app.exception_handler(PyMongoError)
async def mongodb_exception_handler(_: Request, exc: PyMongoError) -> JSONResponse:
    logger.exception("Database error: %s", exc)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "A database error occurred."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Internal server error."},
    )


@app.get("/")
async def root() -> MessageResponse:
    return MessageResponse(message="HAR backend is running.")


app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(activities.router, prefix=settings.api_v1_prefix)
