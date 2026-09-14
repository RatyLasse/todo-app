from pathlib import Path

import pytest

from todo_app.config import Settings


def test_default_database_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TODO_DATABASE_PATH", raising=False)

    assert Settings.from_env().database_path == Path("data/tasks.sqlite3")


def test_configured_database_path(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    database_path = tmp_path / "custom.sqlite3"
    monkeypatch.setenv("TODO_DATABASE_PATH", str(database_path))

    assert Settings.from_env().database_path == database_path


@pytest.mark.parametrize("value", ["", " \t "])
def test_empty_database_path_is_rejected(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("TODO_DATABASE_PATH", value)

    with pytest.raises(ValueError, match="TODO_DATABASE_PATH"):
        Settings.from_env()
