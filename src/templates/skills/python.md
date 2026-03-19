### Skill: Python Guidelines
- **Type Hints**: Always annotate function parameters and return types. Use `from __future__ import annotations` for forward references. Use `X | None` over `Optional[X]` (Python 3.10+).
- **Dataclasses / Pydantic**: Use `@dataclass` or Pydantic `BaseModel` for structured data. Never pass raw `dict` across function boundaries.
- **Comprehensions**: Prefer list/dict/set comprehensions over `map()`/`filter()` for readability. Avoid nested comprehensions deeper than two levels.
- **Context Managers**: Use `with` for all resource management (files, connections, locks). Never leave resources open outside a context manager.
- **Exceptions**: Catch specific exception types, never bare `except:` or `except Exception:` without re-raising or logging. Create domain-specific exception classes.
- **Immutability**: Use `tuple` over `list` for fixed-size sequences. Use `frozenset` for immutable sets. Avoid mutable default arguments (`def fn(items=[])` is a bug).
- **Pathlib**: Use `pathlib.Path` for all filesystem operations. Never concatenate paths with string operations.
- **Async**: Use `async`/`await` consistently. Never mix blocking I/O inside async functions — use `asyncio.to_thread()` to offload blocking calls.
