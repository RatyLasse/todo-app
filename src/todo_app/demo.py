"""Serve the locally built UI and API from the repository working directory."""

import argparse
from pathlib import Path

import uvicorn

from todo_app.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    if not 1 <= arguments.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    frontend_directory = Path("frontend/dist").resolve()
    if not (frontend_directory / "index.html").is_file():
        parser.error(
            "Frontend build not found. From the repository root, run "
            "'npm --prefix frontend ci' and 'npm --prefix frontend run build', "
            "then 'uv run todo-demo'."
        )

    uvicorn.run(
        create_app(frontend_directory=frontend_directory),
        host="127.0.0.1",
        port=arguments.port,
    )


if __name__ == "__main__":
    main()
