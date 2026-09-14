import os
from dataclasses import dataclass
from pathlib import Path
from typing import Self


@dataclass(frozen=True)
class Settings:
    database_path: Path = Path("data/tasks.sqlite3")

    @classmethod
    def from_env(cls) -> Self:
        database_path = os.environ.get("TODO_DATABASE_PATH", "data/tasks.sqlite3")
        if not database_path.strip():
            raise ValueError("TODO_DATABASE_PATH must be a non-empty file path")
        return cls(database_path=Path(database_path))
