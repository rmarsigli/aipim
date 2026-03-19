### Skill: Prisma ORM Guidelines
- **Single Client Instance**: Instantiate `PrismaClient` once and export it as a singleton. Never create a new client per request — it will exhaust the connection pool.
- **Select Over FindMany**: Always use `select` or `include` explicitly. Never call `findMany()` without constraining which fields are returned on large tables.
- **Transactions**: Use `prisma.$transaction([...])` for multi-step operations that must be atomic. Never perform multiple dependent writes outside a transaction.
- **Migrations**: Use `prisma migrate dev` in development and `prisma migrate deploy` in CI/production. Never edit migration SQL files manually after they are applied.
- **Schema as Source of Truth**: The `schema.prisma` file is the source of truth for the data model. Never alter the database schema directly — always go through migrations.
- **Soft Deletes**: Implement soft deletes at the Prisma middleware level, not per-query. Ensure all `findMany`/`findFirst` calls exclude soft-deleted rows via middleware.
- **Pagination**: Always paginate with `take` + `skip` or cursor-based pagination. Never return an unbounded `findMany()` result to a client.
- **Type Safety**: Use generated Prisma types (`Prisma.UserCreateInput`, `Prisma.UserWhereInput`) for input validation. Do not redefine equivalent TypeScript interfaces manually.
