from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.user import UserRead


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, alias="fullName", max_length=120)

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if value.isspace():
            raise ValueError("Password must not be blank.")

        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(str_strip_whitespace=True)


class TokenResponse(BaseModel):
    access_token: str = Field(alias="accessToken")
    token_type: str = Field(default="bearer", alias="tokenType")
    expires_in: int = Field(alias="expiresIn")
    user: UserRead

    model_config = ConfigDict(populate_by_name=True)
