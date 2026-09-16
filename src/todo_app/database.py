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
                    updated_at TEXT NOT NULL,
                    position INTEGER NOT NULL DEFAULT 0,
                    completed_position INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
            }
            if "position" not in columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0"
                )
                existing_ids = connection.execute(
                    """
                    SELECT id FROM tasks
                    WHERE completed = 0
                    ORDER BY created_at ASC, id ASC
                    """
                ).fetchall()
                for position, row in enumerate(existing_ids, start=1):
                    connection.execute(
                        "UPDATE tasks SET position = ? WHERE id = ?",
                        (position, row["id"]),
                    )
            if "completed_position" not in columns:
                connection.execute(
                    """
                    ALTER TABLE tasks
                    ADD COLUMN completed_position INTEGER NOT NULL DEFAULT 0
                    """
                )
                completed_ids = connection.execute(
                    """
                    SELECT id FROM tasks
                    WHERE completed = 1
                    ORDER BY updated_at ASC, id ASC
                    """
                ).fetchall()
                for position, row in enumerate(completed_ids, start=1):
                    connection.execute(
                        "UPDATE tasks SET completed_position = ? WHERE id = ?",
                        (position, row["id"]),
                    )

    def list_tasks(self) -> list[Task]:
        with self.connection() as connection:
            rows = connection.execute(
                """
                SELECT * FROM tasks
                ORDER BY completed ASC,
                    CASE WHEN completed = 0 THEN position END DESC,
                    CASE WHEN completed = 1 THEN completed_position END DESC,
                    CASE WHEN completed = 1 THEN updated_at END DESC,
                    id DESC
                """
            ).fetchall()
        return [Task.model_validate(dict(row)) for row in rows]

    def create_task(self, task: TaskCreate) -> Task:
        timestamp = datetime.now(UTC).isoformat()
        with self.connection() as connection:
            position = connection.execute(
                "SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE completed = 0"
            ).fetchone()[0]
            row = connection.execute(
                """
                INSERT INTO tasks (
                    title, completed, priority, label, created_at, updated_at, position,
                    completed_position
                )
                VALUES (?, 0, ?, ?, ?, ?, ?, 0) RETURNING *
                """,
                (task.title, task.priority, task.label, timestamp, timestamp, position),
            ).fetchone()
            return Task.model_validate(dict(row))

    def update_task(self, task_id: int, task: TaskUpdate) -> Task | None:
        changes = task.model_dump(exclude_unset=True)
        # Column names come only from the validated schema; all values are bound.
        timestamp = datetime.now(UTC).isoformat()
        with self.connection() as connection:
            current = connection.execute(
                "SELECT completed FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
            if current is None:
                return None
            if "completed" in changes and changes["completed"] != current["completed"]:
                if changes["completed"]:
                    completed_position = connection.execute(
                        """
                        SELECT COALESCE(MAX(completed_position), 0) + 1
                        FROM tasks
                        WHERE completed = 1
                        """
                    ).fetchone()[0]
                    changes["completed_position"] = completed_position
                else:
                    changes["completed_position"] = 0
            assignments = ", ".join(f"{field} = ?" for field in changes)
            row = connection.execute(
                f"UPDATE tasks SET {assignments}, updated_at = ? "
                "WHERE id = ? RETURNING *",
                (*changes.values(), timestamp, task_id),
            ).fetchone()
            return Task.model_validate(dict(row)) if row is not None else None

    def reorder_tasks(self, task_ids: list[int]) -> list[Task] | None:
        with self.connection() as connection:
            task_states = {
                row["id"]: row["completed"]
                for row in connection.execute(
                    "SELECT id, completed FROM tasks"
                ).fetchall()
            }
            if len(task_ids) != len(task_states) or set(task_ids) != set(task_states):
                return None

            open_ids = [task_id for task_id in task_ids if not task_states[task_id]]
            completed_ids = [task_id for task_id in task_ids if task_states[task_id]]
            for index, task_id in enumerate(open_ids):
                connection.execute(
                    "UPDATE tasks SET position = ? WHERE id = ?",
                    (len(open_ids) - index, task_id),
                )
            for index, task_id in enumerate(completed_ids):
                connection.execute(
                    "UPDATE tasks SET completed_position = ? WHERE id = ?",
                    (len(completed_ids) - index, task_id),
                )
            rows = connection.execute(
                """
                SELECT * FROM tasks
                ORDER BY completed ASC,
                    CASE WHEN completed = 0 THEN position END DESC,
                    CASE WHEN completed = 1 THEN completed_position END DESC,
                    CASE WHEN completed = 1 THEN updated_at END DESC,
                    id DESC
                """
            ).fetchall()
        return [Task.model_validate(dict(row)) for row in rows]

    def delete_task(self, task_id: int) -> bool:
        with self.connection() as connection:
            cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return cursor.rowcount > 0
