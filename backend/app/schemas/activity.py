from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ActivityCreateRequest(BaseModel):
    user_id: str = Field(alias="userId", min_length=1)
    activity: str = Field(min_length=1, max_length=64)
    confidence: float = Field(ge=0, le=1)
    timestamp: int = Field(ge=0)

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    @field_validator("activity")
    @classmethod
    def normalize_activity(cls, value: str) -> str:
        return value.lower()


class ActivityRead(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    activity: str
    confidence: float
    timestamp: int
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ActivityHistoryResponse(BaseModel):
    items: list[ActivityRead]
    total: int


class ActivityDeleteResponse(BaseModel):
    deleted_count: int = Field(alias="deletedCount", ge=0)

    model_config = ConfigDict(populate_by_name=True)


class ActivityStatItem(BaseModel):
    activity: str
    count: int
    total_time_ms: int = Field(alias="totalTimeMs")

    model_config = ConfigDict(populate_by_name=True)


class ActivityStatsResponse(BaseModel):
    user_id: str = Field(alias="userId")
    total_logs: int = Field(alias="totalLogs")
    activities: list[ActivityStatItem]

    model_config = ConfigDict(populate_by_name=True)
