from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


ACTIVITY_COLLECTION = "activities"


class ActivityDocument(BaseModel):
    id: str
    user_id: str
    activity: str
    confidence: float
    timestamp: int
    created_at: datetime
