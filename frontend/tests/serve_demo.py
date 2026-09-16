import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from todo_app.demo import main

if __name__ == "__main__":
    with TemporaryDirectory(prefix="todo-demo-tests-") as directory:
        os.environ["TODO_DATABASE_PATH"] = str(Path(directory) / "tasks.sqlite3")
        os.environ["OPENROUTER_API_KEY"] = ""
        os.environ["OPENROUTER_MODEL"] = "unused-test-model"
        sys.argv = ["todo-demo", "--port", "18001"]
        main()
