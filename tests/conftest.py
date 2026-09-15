from collections.abc import Iterator
from pathlib import Path
from typing import NoReturn

import pytest
from fastapi.testclient import TestClient

from todo_app import suggestions
from todo_app.config import Settings
from todo_app.main import create_app


@pytest.fixture(autouse=True)
def isolate_configuration_and_provider(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    for name in ("TODO_DATABASE_PATH", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"):
        monkeypatch.delenv(name, raising=False)

    def forbid_live_provider(*args: object, **kwargs: object) -> NoReturn:
        pytest.fail("Tests must inject a provider or use a mocked SDK transport")

    monkeypatch.setattr(suggestions, "AsyncOpenAI", forbid_live_provider)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(database_path=tmp_path / "data" / "tasks.sqlite3")


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
