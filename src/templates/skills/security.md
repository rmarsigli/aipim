### Skill: Secure Coding Guidelines
- **Input Validation**: Validate ALL external input at the system boundary (user input, API responses, webhooks, env vars). Reject early and fail loudly with clear error messages.
- **SQL Injection**: Always use parameterized queries or an ORM. Never concatenate or interpolate user input into SQL strings.
- **XSS**: Escape all output rendered in HTML. Never use `innerHTML` or `dangerouslySetInnerHTML` with unsanitized data. Prefer text node APIs.
- **Secrets**: Never hardcode secrets, API keys, or credentials. Use environment variables. Ensure secrets are never logged, even at debug level.
- **Authentication vs Authorization**: Authenticate first, then authorize. Enforce authorization at the service layer, not only at the route or middleware level.
- **CSRF**: Protect all state-changing endpoints (POST/PUT/PATCH/DELETE) with CSRF tokens in browser-facing applications.
- **Dependencies**: Run `npm audit` / `composer audit` regularly. Pin dependency versions. Review changelogs when upgrading packages with known CVEs.
- **Error Responses**: Never expose stack traces, internal file paths, query details, or database schema in API error responses sent to clients.
