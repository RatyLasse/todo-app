from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    StrictBool,
    StringConstraints,
    model_validator,
)

type Priority = Literal["low", "medium", "high"]
type Label = Literal["work", "personal", "errands", "finance", "health", "other"]
type TaskTitle = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200, strict=True),
]


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: TaskTitle
    priority: Priority = "medium"
    label: Label = "other"


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: TaskTitle | None = None
    completed: StrictBool | None = None
    priority: Priority | None = None
    label: Label | None = None

    @model_validator(mode="after")
    def require_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Supply at least one task field")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Task fields cannot be null")
        return self


class Task(BaseModel):
    id: int
    title: TaskTitle
    completed: bool
    priority: Priority
    label: Label
    created_at: datetime
    updated_at: datetime


class ErrorResponse(BaseModel):
    detail: str


class SuggestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: TaskTitle


class TaskMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", revalidate_instances="always")

    priority: Priority
    label: Label


class TaskSuggestion(TaskMetadata):
    source: Literal["llm", "fallback"]
