from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from todo_app.config import Settings
from todo_app.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(database_path=tmp_path / "data" / "tasks.sqlite3")


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
