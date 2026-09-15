import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Self

from dotenv import dotenv_values


@dataclass(frozen=True)
class Settings:
    database_path: Path = Path("data/tasks.sqlite3")
    openrouter_api_key: str | None = field(default=None, repr=False)
    openrouter_model: str = "nex-agi/nex-n2.5-mini:free"

    @classmethod
    def from_env(cls, *, env_file: Path | None = Path(".env")) -> Self:
        values = dotenv_values(env_file, interpolate=False) if env_file else {}
        environment = {**values, **os.environ}
        database_path = environment.get("TODO_DATABASE_PATH", "data/tasks.sqlite3")
        if not database_path or not database_path.strip():
            raise ValueError("TODO_DATABASE_PATH must be a non-empty file path")
        model = environment.get("OPENROUTER_MODEL", cls.openrouter_model)
        if not model or not model.strip():
            raise ValueError("OPENROUTER_MODEL must be a non-empty model name")
        api_key = (environment.get("OPENROUTER_API_KEY") or "").strip() or None
        return cls(
            database_path=Path(database_path),
            openrouter_api_key=api_key,
            openrouter_model=model.strip(),
        )
