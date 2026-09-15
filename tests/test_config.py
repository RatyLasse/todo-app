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


def test_dotenv_configuration_and_environment_precedence(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "TODO_DATABASE_PATH=data/from-file.sqlite3\n"
        "OPENROUTER_API_KEY=secret-from-file\n"
        "OPENROUTER_MODEL=model-from-file\n",
        encoding="utf-8",
    )
    settings = Settings.from_env()
    assert settings.database_path == Path("data/from-file.sqlite3")
    assert settings.openrouter_api_key == "secret-from-file"
    assert settings.openrouter_model == "model-from-file"
    assert "secret-from-file" not in repr(settings)

    monkeypatch.setenv("TODO_DATABASE_PATH", "data/from-environment.sqlite3")
    monkeypatch.setenv("OPENROUTER_API_KEY", "secret-from-environment")
    monkeypatch.setenv("OPENROUTER_MODEL", "model-from-environment")
    settings = Settings.from_env()
    assert settings.database_path == Path("data/from-environment.sqlite3")
    assert settings.openrouter_api_key == "secret-from-environment"
    assert settings.openrouter_model == "model-from-environment"
    assert "secret-from-environment" not in repr(settings)

    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    assert Settings.from_env().openrouter_api_key is None


def test_dotenv_can_be_disabled_and_does_not_change_environment(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text(
        "OPENROUTER_API_KEY=secret-from-file\n", encoding="utf-8"
    )
    assert Settings.from_env().openrouter_api_key == "secret-from-file"
    assert Settings.from_env(env_file=None).openrouter_api_key is None


@pytest.mark.parametrize("value", ["", " \t "])
def test_empty_model_is_rejected(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setenv("OPENROUTER_MODEL", value)
    with pytest.raises(ValueError, match="OPENROUTER_MODEL"):
        Settings.from_env()


def test_missing_key_and_default_model() -> None:
    settings = Settings.from_env()
    assert settings.openrouter_api_key is None
    assert settings.openrouter_model == Settings.openrouter_model


def test_blank_key_is_treated_as_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "  \t ")
    assert Settings.from_env().openrouter_api_key is None


def test_old_openai_settings_are_not_used(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / ".env").write_text(
        "OPENAI_API_KEY=old-provider-key\nOPENAI_MODEL=old-model\n", encoding="utf-8"
    )
    monkeypatch.setenv("OPENAI_API_KEY", "old-environment-key")
    monkeypatch.setenv("OPENAI_MODEL", "old-environment-model")
    settings = Settings.from_env()
    assert settings.openrouter_api_key is None
    assert settings.openrouter_model == "nex-agi/nex-n2.5-mini:free"
