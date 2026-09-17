"""Manually verify the live AI endpoint using canned titles and a temporary database."""

from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from todo_app.config import Settings
from todo_app.main import create_app
from todo_app.schemas import TaskSuggestion


def main() -> int:
    settings = Settings.from_env()
    if not settings.openrouter_api_key:
        print(
            "Set OPENROUTER_API_KEY in the root .env file, then run this command again."
        )
        return 1

    cases = [
        (
            "urgent_finance",
            "Pay the overdue electricity bill urgently today",
            "high",
            "finance",
        ),
        (
            "optional_personal",
            "Chill in a hammock",
            "low",
            "personal",
        ),
        (
            "broken_car_tire",
            "Replace a broken car tire",
            "high",
            "other",
        ),
        ("routine_health", "Book a routine dentist appointment", "medium", "health"),
    ]
    passed = True
    with TemporaryDirectory(prefix="todo-live-ai-") as directory:
        isolated_settings = replace(
            settings, database_path=Path(directory) / "tasks.sqlite3"
        )
        with TestClient(create_app(isolated_settings)) as client:
            for name, title, priority, label in cases:
                response = client.post("/api/task-suggestions", json={"title": title})
                if response.status_code != 200:
                    print(f"{name}: failed (HTTP {response.status_code})")
                    passed = False
                    continue
                result = TaskSuggestion.model_validate(response.json())
                matches = (
                    result.source == "llm"
                    and result.priority == priority
                    and result.label == label
                )
                print(
                    f"{name}: {'PASS' if matches else 'FAIL'} "
                    f"source={result.source} priority={result.priority} "
                    f"label={result.label}"
                )
                passed = passed and matches
            if client.get("/api/tasks").json() != []:
                print("FAIL: suggestions unexpectedly saved tasks")
                passed = False
    if not passed:
        print(
            "Check the OpenRouter key, model access, free-plan limits, "
            "and prompt policy."
        )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
