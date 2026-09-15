from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn

from todo_app.config import Settings
from todo_app.main import create_app


def main() -> None:
    with TemporaryDirectory(prefix="todo-browser-tests-") as directory:
        settings = Settings(database_path=Path(directory) / "tasks.sqlite3")
        uvicorn.run(create_app(settings), host="127.0.0.1", port=18000)


if __name__ == "__main__":
    main()
