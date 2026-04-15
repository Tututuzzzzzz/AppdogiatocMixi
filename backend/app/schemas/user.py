from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRead(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None = Field(default=None, alias="fullName")
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
