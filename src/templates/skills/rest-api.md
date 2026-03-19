### Skill: REST API Design Guidelines
- **HTTP Verbs**: Use `GET` (read), `POST` (create), `PUT`/`PATCH` (update), `DELETE` (delete). Never use `GET` for mutations.
- **Status Codes**: Return precise codes: `200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `422` Validation Error, `500` Internal Error.
- **Response Envelope**: Use consistent shapes: `{ data: T }` for success, `{ error: { message, code } }` for failures. Never return bare arrays at the root.
- **Versioning**: Version APIs in the URL prefix (`/api/v1/`). Never break existing endpoints without a version bump.
- **Pagination**: Paginate all list endpoints. Return `{ data: [], meta: { page, per_page, total } }`. Never return unbounded collections.
- **Resource Naming**: Use plural nouns for resources (`/users`, `/orders`). Never use verbs in URLs (`/getUser`, `/createOrder` are wrong).
- **Filtering/Sorting**: Use query parameters for filtering and sorting (`?status=active&sort=-created_at`). Never encode filters in the URL path.
- **Idempotency**: `PUT` and `DELETE` must be idempotent. Use idempotency keys for non-idempotent `POST` actions when safe retry behavior is required.
