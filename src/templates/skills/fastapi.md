### Skill: FastAPI Guidelines
- **Pydantic Models**: Define request bodies and response schemas as Pydantic `BaseModel` classes. Never access `request.body()` raw or use plain `dict` as input/output.
- **Dependency Injection**: Use `Depends()` for shared logic (auth, DB sessions, pagination params). Do not repeat session/auth setup inside route handlers.
- **Response Models**: Always declare `response_model=` on route decorators to enforce output schema and strip extra fields from ORM objects.
- **Async Routes**: Use `async def` for I/O-bound routes. Use regular `def` for CPU-bound routes (FastAPI runs them in a thread pool automatically).
- **Lifespan**: Use the `lifespan` context manager for startup/shutdown logic (DB pool creation, cache warm-up). Do not use deprecated `@app.on_event`.
- **Exception Handling**: Raise `HTTPException` for client errors. Register `@app.exception_handler` for domain exceptions — never return error dicts manually from route handlers.
- **Routers**: Split routes into `APIRouter` modules by domain. Register them with a prefix and tags in `main.py`. Never put all routes in a single file.
- **Background Tasks**: Use `BackgroundTasks` for fire-and-forget work. Use a proper queue (Celery, ARQ) for retryable or long-running operations.
