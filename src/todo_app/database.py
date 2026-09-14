import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path

from todo_app.schemas import Task, TaskCreate, TaskUpdate


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        # Each operation owns its connection and transaction, including on failure.
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.row_factory = sqlite3.Row
            yield connection

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
                    priority TEXT NOT NULL CHECK (
                        priority IN ('low', 'medium', 'high')
                    ),
                    label TEXT NOT NULL CHECK (
                        label IN (
                            'work', 'personal', 'errands', 'finance', 'health', 'other'
                        )
                    ),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def list_tasks(self) -> list[Task]:
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC, id DESC"
            ).fetchall()
        return [Task.model_validate(dict(row)) for row in rows]

    def create_task(self, task: TaskCreate) -> Task:
        timestamp = datetime.now(UTC).isoformat()
        with self.connection() as connection:
            row = connection.execute(
                """
                INSERT INTO tasks (title, priority, label, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?) RETURNING *
                """,
                (task.title, task.priority, task.label, timestamp, timestamp),
            ).fetchone()
            return Task.model_validate(dict(row))

    def update_task(self, task_id: int, task: TaskUpdate) -> Task | None:
        changes = task.model_dump(exclude_unset=True)
        # Column names come only from the validated schema; all values are bound.
        assignments = ", ".join(f"{field} = ?" for field in changes)
        timestamp = datetime.now(UTC).isoformat()
        with self.connection() as connection:
            row = connection.execute(
                f"UPDATE tasks SET {assignments}, updated_at = ? "
                "WHERE id = ? RETURNING *",
                (*changes.values(), timestamp, task_id),
            ).fetchone()
            return Task.model_validate(dict(row)) if row is not None else None

    def delete_task(self, task_id: int) -> bool:
        with self.connection() as connection:
            cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return cursor.rowcount > 0
