import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path as FilePath
from typing import Annotated

from fastapi import FastAPI, HTTPException, Path, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import RequestResponseEndpoint

from todo_app.config import Settings
from todo_app.database import Database
from todo_app.schemas import (
    ErrorResponse,
    SuggestionRequest,
    Task,
    TaskCreate,
    TaskSuggestion,
    TaskUpdate,
)
from todo_app.suggestions import SuggestionProvider, suggest_task

logger = logging.getLogger(__name__)
type TaskId = Annotated[int, Path(ge=1, le=2**63 - 1)]


def create_app(
    settings: Settings | None = None,
    *,
    suggestion_provider: SuggestionProvider | None = None,
    frontend_directory: FilePath | None = None,
) -> FastAPI:
    # SDK debug logs include request bodies; keep task text out of application logs.
    logging.getLogger("openai").setLevel(logging.WARNING)
    configuration = settings if settings is not None else Settings.from_env()
    database = Database(configuration.database_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database.initialize()
        yield

    app = FastAPI(
        title="Todo App",
        lifespan=lifespan,
        responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    )

    @app.middleware("http")
    async def handle_unexpected_errors(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        try:
            return await call_next(request)
        except Exception:
            # Consume the exception so the server cannot log sensitive error details.
            logger.error("request_failed category=unexpected_error")
            return JSONResponse(
                status_code=500, content={"detail": "Internal server error"}
            )

    @app.exception_handler(RequestValidationError)
    async def handle_invalid_request(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": "Invalid request"})

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/task-suggestions")
    async def create_suggestion(suggestion: SuggestionRequest) -> TaskSuggestion:
        return await suggest_task(suggestion.title, configuration, suggestion_provider)

    @app.get("/api/tasks")
    def list_tasks() -> list[Task]:
        return database.list_tasks()

    @app.post("/api/tasks", status_code=201)
    def create_task(task: TaskCreate) -> Task:
        return database.create_task(task)

    @app.patch("/api/tasks/{task_id}", responses={404: {"model": ErrorResponse}})
    def update_task(task_id: TaskId, task: TaskUpdate) -> Task:
        updated_task = database.update_task(task_id, task)
        if updated_task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return updated_task

    @app.delete(
        "/api/tasks/{task_id}",
        status_code=204,
        responses={404: {"model": ErrorResponse}},
    )
    def delete_task(task_id: TaskId) -> Response:
        if not database.delete_task(task_id):
            raise HTTPException(status_code=404, detail="Task not found")
        return Response(status_code=204)

    if frontend_directory is None:

        @app.get("/", include_in_schema=False)
        def api_root() -> RedirectResponse:
            return RedirectResponse(url="/docs")

    else:
        app.mount("/", StaticFiles(directory=frontend_directory, html=True), name="ui")

    return app
