from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from todo_app import demo
from todo_app.config import Settings
from todo_app.main import create_app


def test_built_ui_and_api_share_a_server(settings: Settings, tmp_path: Path) -> None:
    build = tmp_path / "frontend" / "dist"
    assets = build / "assets"
    assets.mkdir(parents=True)
    (build / "index.html").write_text("<html>Todo App</html>", encoding="utf-8")
    (assets / "app.js").write_text("console.log('loaded');", encoding="utf-8")
    (tmp_path / ".env").write_text("PRIVATE_VALUE=secret", encoding="utf-8")

    with TestClient(create_app(settings, frontend_directory=build)) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert response.text == "<html>Todo App</html>"
        assert client.get("/assets/app.js").text == "console.log('loaded');"
        assert client.get("/api/health").json() == {"status": "ok"}
        created = client.post("/api/tasks", json={"title": "Demo task"})
        assert created.status_code == 201
        assert client.get("/api/tasks").json() == [created.json()]
        assert client.post(
            "/api/task-suggestions", json={"title": "Demo task"}
        ).json() == {"priority": "medium", "label": "other", "source": "fallback"}

        for path in (
            "/api/unknown",
            "/assets/missing.js",
            "/.env",
            "/%2e%2e/%2e%2e/.env",
            "/data/tasks.sqlite3",
        ):
            missing = client.get(path)
            assert missing.status_code == 404
            assert missing.json() == {"detail": "Not Found"}
        assert client.get("/docs").status_code == 200

    with TestClient(create_app(settings, frontend_directory=build)) as restarted:
        assert restarted.get("/api/tasks").json() == [created.json()]


def test_development_root_redirects_to_docs(client: TestClient) -> None:
    response = client.get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/docs"


def test_demo_explains_missing_build(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr("sys.argv", ["todo-demo"])
    with pytest.raises(SystemExit, match="2"):
        demo.main()
    assert "npm --prefix frontend run build" in capsys.readouterr().err


@pytest.mark.parametrize("port", ["0", "65536", "invalid"])
def test_demo_rejects_invalid_port(monkeypatch: pytest.MonkeyPatch, port: str) -> None:
    monkeypatch.setattr("sys.argv", ["todo-demo", "--port", port])
    with pytest.raises(SystemExit, match="2"):
        demo.main()
