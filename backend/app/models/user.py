from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


USER_COLLECTION = "users"


class UserDocument(BaseModel):
    id: str
    email: EmailStr
    hashed_password: str
    full_name: str | None = None
    is_active: bool = True
    created_at: datetime
