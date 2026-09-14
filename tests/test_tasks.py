import logging
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from todo_app.config import Settings
from todo_app.database import Database
from todo_app.main import create_app
from todo_app.schemas import Task, TaskCreate


def test_health_and_empty_list(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    response = client.get("/api/tasks")
    assert response.status_code == 200
    assert response.json() == []


def test_create_task_with_defaults(client: TestClient) -> None:
    response = client.post("/api/tasks", json={"title": "  Buy milk \t\n"})

    assert response.status_code == 201
    task = response.json()
    assert task == {
        "id": task["id"],
        "title": "Buy milk",
        "completed": False,
        "priority": "medium",
        "label": "other",
        "created_at": task["created_at"],
        "updated_at": task["created_at"],
    }
    assert isinstance(task["id"], int)
    assert task["id"] > 0
    assert datetime.fromisoformat(task["created_at"]).utcoffset() == timedelta(0)
    assert client.get("/api/tasks").json() == [task]


@pytest.mark.parametrize(
    ("priority", "label"),
    [
        ("low", "work"),
        ("medium", "personal"),
        ("high", "errands"),
        ("low", "finance"),
        ("medium", "health"),
        ("high", "other"),
    ],
)
def test_create_with_metadata(client: TestClient, priority: str, label: str) -> None:
    response = client.post(
        "/api/tasks", json={"title": "A task", "priority": priority, "label": label}
    )

    assert response.status_code == 201
    assert response.json()["priority"] == priority
    assert response.json()["label"] == label


@pytest.mark.parametrize(
    "title", ["x", "x" * 200, "  " + "📝" * 200 + "\t", "\x00task"]
)
def test_title_length_boundaries(client: TestClient, title: str) -> None:
    response = client.post("/api/tasks", json={"title": title})

    assert response.status_code == 201
    assert response.json()["title"] == title.strip()
    assert client.get("/api/tasks").json() == [response.json()]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"title": ""},
        {"title": " \t\n\u2003"},
        {"title": "x" * 201},
        {"title": None},
        {"title": 12},
        {"title": True},
        {"title": []},
        {"title": "Task", "priority": "urgent"},
        {"title": "Task", "priority": None},
        {"title": "Task", "label": "home"},
        {"title": "Task", "label": None},
        {"title": "Task", "completed": True},
        {"title": "Task", "id": 4},
        {"title": "Task", "created_at": "2026-01-01"},
        {"title": "Task", "updated_at": "2026-01-01"},
        {"title": "Task", "extra": "value"},
    ],
)
def test_invalid_create(client: TestClient, payload: dict[str, object]) -> None:
    response = client.post("/api/tasks", json=payload)

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}
    assert client.get("/api/tasks").json() == []


def test_edit_complete_and_reopen(client: TestClient) -> None:
    task = client.post("/api/tasks", json={"title": "Original"}).json()
    task_url = f"/api/tasks/{task['id']}"

    response = client.patch(
        task_url, json={"title": "  Revised  ", "priority": "high", "label": "work"}
    )
    assert response.status_code == 200
    edited = response.json()
    assert edited["title"] == "Revised"
    assert edited["priority"] == "high"
    assert edited["label"] == "work"
    assert edited["completed"] is False
    assert edited["id"] == task["id"]
    assert edited["created_at"] == task["created_at"]

    for completed in (True, False):
        response = client.patch(task_url, json={"completed": completed})
        assert response.status_code == 200
        updated = response.json()
        assert updated["completed"] is completed
        for field in ("id", "title", "priority", "label", "created_at"):
            assert updated[field] == edited[field]
        assert client.get("/api/tasks").json() == [updated]


def test_timestamps_and_creation_order(client: TestClient) -> None:
    created_at = datetime(2026, 1, 2, 12, tzinfo=UTC)
    updated_at = created_at + timedelta(hours=1)
    with patch("todo_app.database.datetime") as clock:
        clock.now.return_value = created_at
        first = client.post("/api/tasks", json={"title": "First"}).json()
        second = client.post("/api/tasks", json={"title": "Second"}).json()
        clock.now.return_value = updated_at
        updated = client.patch(
            f"/api/tasks/{first['id']}", json={"title": "Updated first"}
        ).json()

    assert datetime.fromisoformat(first["created_at"]) == created_at
    assert first["updated_at"] == first["created_at"]
    assert updated["created_at"] == first["created_at"]
    assert datetime.fromisoformat(updated["updated_at"]) == updated_at
    assert client.get("/api/tasks").json() == [second, updated]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"title": ""},
        {"title": " \t\n"},
        {"title": "x" * 201},
        {"title": 42},
        {"title": None},
        {"completed": None},
        {"priority": None},
        {"label": None},
        {"completed": "false"},
        {"completed": 1},
        {"completed": 0},
        {"priority": "urgent"},
        {"label": "home"},
        {"id": 4},
        {"created_at": "2026-01-01"},
        {"updated_at": "2026-01-01"},
        {"title": "Changed", "extra": "value"},
        {"title": "Changed", "priority": None},
    ],
)
def test_invalid_patch_preserves_task(
    client: TestClient, payload: dict[str, object]
) -> None:
    original = client.post("/api/tasks", json={"title": "Original"}).json()

    response = client.patch(f"/api/tasks/{original['id']}", json=payload)

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}
    assert client.get("/api/tasks").json() == [original]


def test_delete_task(client: TestClient) -> None:
    task = client.post("/api/tasks", json={"title": "Delete me"}).json()
    kept = client.post("/api/tasks", json={"title": "Keep me"}).json()

    response = client.delete(f"/api/tasks/{task['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/tasks").json() == [kept]
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 404


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
def test_unknown_task(client: TestClient, method: str) -> None:
    response = client.request(
        method, "/api/tasks/9223372036854775807", json={"completed": True}
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
@pytest.mark.parametrize("task_id", ["abc", "0", "-1", "1.5", "9223372036854775808"])
def test_invalid_task_id(client: TestClient, method: str, task_id: str) -> None:
    response = client.request(method, f"/api/tasks/{task_id}", json={"completed": True})

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}


@pytest.mark.parametrize("body", ["{", "null", "[]", '"text"'])
def test_invalid_json_body(client: TestClient, body: str) -> None:
    response = client.post(
        "/api/tasks", content=body, headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}


def test_database_survives_application_restarts(settings: Settings) -> None:
    app = create_app(settings)
    assert not settings.database_path.exists()

    with TestClient(app) as first_client:
        kept = first_client.post("/api/tasks", json={"title": "Keep me"}).json()
        removed = first_client.post("/api/tasks", json={"title": "Remove me"}).json()
        updated = first_client.patch(
            f"/api/tasks/{kept['id']}", json={"completed": True, "label": "personal"}
        ).json()
        assert first_client.delete(f"/api/tasks/{removed['id']}").status_code == 204

    with TestClient(create_app(settings)) as second_client:
        assert second_client.get("/api/tasks").json() == [updated]
        added = second_client.post("/api/tasks", json={"title": "New task"}).json()
        assert added["id"] > removed["id"]


def test_sql_syntax_in_titles_is_stored_as_text(client: TestClient) -> None:
    title = "Robert'); DROP TABLE tasks;--"
    response = client.post("/api/tasks", json={"title": title})

    assert response.status_code == 201
    task = response.json()
    assert task["title"] == title
    response = client.patch(
        f"/api/tasks/{task['id']}", json={"title": title + " revised"}
    )
    assert response.status_code == 200
    assert client.get("/api/tasks").json() == [response.json()]


def test_task_text_is_not_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    title = "private-task-title-sentinel"
    with caplog.at_level(logging.DEBUG):
        assert client.post("/api/tasks", json={"title": title}).status_code == 201
        response = client.post(
            "/api/tasks", json={"title": title, "priority": "invalid"}
        )

    assert response.status_code == 422
    assert title not in response.text
    assert title not in caplog.text


def test_unexpected_errors_hide_sensitive_details(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    title = "private-task-title-sentinel"
    credential = "secret-api-key-sentinel"

    def fail_create(self: Database, task: TaskCreate) -> Task:
        raise RuntimeError(f"{task.title} {credential}")

    monkeypatch.setattr(Database, "create_task", fail_create)
    with caplog.at_level(logging.DEBUG):
        response = client.post("/api/tasks", json={"title": title})

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "category=unexpected_error" in caplog.text
    for secret in (title, credential):
        assert secret not in caplog.text
        assert secret not in response.text
    assert client.get("/api/health").status_code == 200


def test_openapi_documents_stable_errors(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    responses = response.json()["paths"]["/api/tasks/{task_id}"]["patch"]["responses"]
    for status in ("404", "422", "500"):
        assert responses[status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorResponse"
        }
