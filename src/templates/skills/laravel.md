### Skill: Laravel Guidelines
- **Eloquent**: Never use `all()` on large tables. Always scope queries with `where`, `limit`, or `chunk`. Use `with()` for eager loading to eliminate N+1 queries.
- **Controllers**: Keep controllers thin — one public method per action, delegate business logic to Actions, Services, or Jobs.
- **Form Requests**: Always use Form Request classes for validation. Never call `$request->validate()` directly in controllers for non-trivial rules.
- **Policies**: Authorize via Policies or Gates. Never inline `Auth::user()->role === 'admin'` checks inside controllers or views.
- **Migrations**: Never modify existing migrations in a deployed environment. Always create a new migration for schema changes.
- **Config over `env()`**: Access configuration via `config('key')`. Never call `env()` outside of `config/` files — it breaks config caching.
- **Jobs & Queues**: Dispatch heavy or slow operations as queued jobs. Mark jobs `ShouldBeUnique` when idempotency is required.
- **Factories**: Use model factories for all test data. Never reuse seeder classes designed for testing in production seeds.
