# Rust Production Guidelines

## Core Principles
- **Edition**: Rust 2021+ (latest stable).
- **Philosophy**: Zero-cost abstractions, memory safety, fearless concurrency.
- **Naming**:
  - Files: `snake_case` (e.g., `user_repository.rs`).
  - Modules: `snake_case` (e.g., `mod database_client;`).
  - Types/Traits: `PascalCase` (e.g., `struct UserProfile`, `trait Serialize`).
  - Functions/Variables: `snake_case` (e.g., `fn calculate_hash()`).
  - Constants: `SCREAMING_SNAKE_CASE` (e.g., `const MAX_CONNECTIONS: usize = 100;`).

## Project Structure (Workspace)
```
├── Cargo.toml           # Workspace manifest
├── src/
│   ├── main.rs          # Binary entry point
│   ├── lib.rs           # Library root
│   ├── models/          # Domain models
│   ├── repositories/    # Data access layer
│   ├── services/        # Business logic
│   ├── handlers/        # HTTP/API handlers
│   └── utils/           # Shared utilities
├── tests/               # Integration tests
├── benches/             # Benchmarks (criterion)
└── examples/            # Usage examples
```

## Production Coding Standards

### Error Handling (CRITICAL)
- **NEVER** use `.unwrap()` or `.expect()` in production code paths.
- **ALWAYS** use `Result<T, E>` for fallible operations.
- **PREFER** `?` operator for error propagation.
- **USE** `anyhow` for applications, `thiserror` for libraries.
- **IMPLEMENT** proper error types with context.

```rust
// GOOD: Production-ready
pub async fn fetch_user(id: UserId) -> Result<User, DatabaseError> {
    db.query_one("SELECT * FROM users WHERE id = $1", &[&id])
        .await
        .map_err(DatabaseError::Query)?
}

// BAD: Crashes on error
pub async fn fetch_user(id: UserId) -> User {
    db.query_one("SELECT * FROM users WHERE id = $1", &[&id])
        .await
        .unwrap()  // ❌ NEVER IN PRODUCTION
}
```

### Resource Management
- **ALWAYS** implement `Drop` for cleanup when holding resources.
- **USE** RAII pattern (Resource Acquisition Is Initialization).
- **AVOID** `clone()` unless necessary - prefer borrowing (`&T`, `&mut T`).
- **USE** `Arc<T>` for shared ownership, `Rc<T>` only in single-threaded contexts.
- **PREFER** `Cow<'a, T>` when data might be borrowed or owned.

### Async/Await (Modern Rust)
- **RUNTIME**: Use Tokio for production (most battle-tested).
- **AVOID** blocking operations in async contexts - use `tokio::task::spawn_blocking`.
- **USE** `async fn` in traits with `async-trait` crate (or native when stable).
- **PREFER** `tokio::select!` over manual polling.
- **IMPLEMENT** timeouts with `tokio::time::timeout`.

```rust
// GOOD: Non-blocking I/O
#[tokio::main]
async fn main() -> Result<()> {
    let result = tokio::time::timeout(
        Duration::from_secs(5),
        fetch_data()
    ).await??;
    Ok(())
}

// BAD: Blocking async runtime
async fn bad_async() {
    std::thread::sleep(Duration::from_secs(1)); // ❌ Blocks executor
}
```

### Concurrency & Thread Safety
- **USE** `Send` + `Sync` bounds explicitly when needed.
- **PREFER** message passing (channels) over shared state.
- **USE** `tokio::sync::RwLock` in async, `std::sync::RwLock` in sync code.
- **AVOID** `Mutex` for read-heavy workloads - use `RwLock`.
- **IMPLEMENT** graceful shutdown with `CancellationToken` (tokio-util).

### Type System (Leverage Fully)
- **USE** newtypes for domain modeling (`struct UserId(Uuid);`).
- **IMPLEMENT** `From`/`TryFrom` for conversions.
- **USE** `#[non_exhaustive]` for public enums that might grow.
- **PREFER** `Option<T>` over nullable patterns.
- **USE** builder pattern for complex constructors (derive with `derive_builder`).

```rust
// GOOD: Type-safe domain modeling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(Uuid);

impl From<Uuid> for UserId {
    fn from(id: Uuid) -> Self { Self(id) }
}

// BAD: Primitive obsession
type UserId = String; // ❌ No type safety
```

## Essential Production Crates

### Core Infrastructure
- `tokio` - Async runtime (features: `full`)
- `anyhow` - Error handling (applications)
- `thiserror` - Error derives (libraries)
- `serde` + `serde_json` - Serialization
- `tracing` + `tracing-subscriber` - Structured logging

### Web/API (if applicable)
- `axum` - Modern web framework (Tokio-based)
- `tower` - Middleware and service abstractions
- `hyper` - Low-level HTTP (Axum builds on this)
- `reqwest` - HTTP client

### Database
- `sqlx` - Async SQL with compile-time query checks
- `diesel` - Sync ORM (if preferred)
- `redis` - Redis client (async)

### Performance & Observability
- `criterion` - Benchmarking (in `benches/`)
- `pprof` - CPU profiling
- `tracing-opentelemetry` - Distributed tracing
- `metrics` + `metrics-exporter-prometheus` - Metrics

### Security
- `secrecy` - Secret types (zeroize on drop)
- `argon2` - Password hashing
- `jsonwebtoken` - JWT handling

## Linting & Formatting (MANDATORY)

### Clippy (Strict)
```toml
# Cargo.toml
[lints.clippy]
all = "warn"
pedantic = "warn"
unwrap_used = "deny"           # No unwrap in production
expect_used = "deny"           # No expect in production
panic = "deny"                 # No panics
missing_errors_doc = "warn"    # Document error cases
```

### Rustfmt (Auto-format)
```toml
# rustfmt.toml
edition = "2021"
max_width = 100
hard_tabs = false
tab_spaces = 4
newline_style = "Unix"
use_small_heuristics = "Max"
```

### Pre-commit Checks
```bash
# ALWAYS run before commit
cargo fmt --check
cargo clippy -- -D warnings
cargo test --all-features
cargo audit  # Security vulnerabilities
```

## Testing Strategy

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_creation() {
        let user = User::new("alice");
        assert_eq!(user.name(), "alice");
    }

    #[tokio::test]
    async fn test_async_operation() {
        let result = fetch_data().await;
        assert!(result.is_ok());
    }
}
```

### Integration Tests (`tests/`)
- Test public API surface.
- Use test fixtures and builders.
- Mock external dependencies with `mockall` or `wiremock`.

### Property-based Testing
- USE `proptest` or `quickcheck` for edge cases.
- Generates randomized inputs to find bugs.

## Performance Optimization

### Profiling
```bash
# CPU profiling
cargo build --release
perf record -g ./target/release/myapp
perf report

# Memory profiling
cargo install dhat
# Use dhat in code
```

### Optimization Tips
- **AVOID** premature optimization - profile first.
- **USE** `#[inline]` sparingly (hot paths only).
- **PREFER** iterators over manual loops (zero-cost).
- **USE** `SmallVec` for stack-allocated vectors (<= 8 items).
- **ENABLE** LTO in release builds:
```toml
[profile.release]
lto = true
codegen-units = 1
opt-level = 3
```

## Documentation

### Rustdoc (Required)
```rust
/// Fetches user data from the database.
///
/// # Arguments
/// * `id` - The unique user identifier
///
/// # Errors
/// Returns `DatabaseError::NotFound` if user doesn't exist.
///
/// # Examples
/// ```
/// let user = fetch_user(UserId::new()).await?;
/// ```
pub async fn fetch_user(id: UserId) -> Result<User, DatabaseError> {
    // ...
}
```

### README.md Structure
1. **Project Overview** - What it does
2. **Installation** - `cargo install` or Docker
3. **Configuration** - Environment variables
4. **Usage** - Quick start examples
5. **Architecture** - High-level design
6. **Contributing** - How to contribute
7. **License** - Apache-2.0 / MIT dual-license (standard)

## Security Best Practices

### Secrets Management
```rust
use secrecy::{Secret, ExposeSecret};

#[derive(Clone)]
pub struct DatabasePassword(Secret<String>);

// Never logs or displays the secret
impl fmt::Debug for DatabasePassword {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "DatabasePassword([REDACTED])")
    }
}
```

### Dependency Auditing
```bash
# Install cargo-audit
cargo install cargo-audit

# Run before every release
cargo audit

# Check for outdated deps
cargo outdated
```

### Deny Policy (cargo-deny)
```toml
# deny.toml
[advisories]
vulnerability = "deny"
unmaintained = "warn"
```

## Deployment

### Docker
```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/myapp /usr/local/bin/
CMD ["myapp"]
```

### Observability
- **Structured Logging**: `tracing` with JSON format
- **Metrics**: Export Prometheus metrics
- **Health Checks**: `/health` endpoint (liveness/readiness)
- **Graceful Shutdown**: SIGTERM handling

## Common Anti-Patterns to AVOID

❌ **Using `unwrap()`/`expect()` in production**
✅ Use `?` or `match` with proper error handling

❌ **Blocking in async contexts**
✅ Use `spawn_blocking` for sync operations

❌ **Excessive cloning**
✅ Prefer borrowing with lifetimes

❌ **`Arc<Mutex<T>>` everywhere**
✅ Use channels for message passing

❌ **No error context**
✅ Add context with `.context()` (anyhow) or `.map_err()`

❌ **`String` for everything**
✅ Use newtypes and domain types

❌ **No integration tests**
✅ Test public API in `tests/`

❌ **Ignoring Clippy warnings**
✅ Fix or explicitly allow with justification

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo fmt -- --check
      - run: cargo clippy -- -D warnings
      - run: cargo test --all-features
      - run: cargo audit
      - run: cargo build --release
```

## Version & Stability

- **Public API**: Follow SemVer strictly (breaking = major bump).
- **MSRV**: Document Minimum Supported Rust Version.
- **Deprecation**: Use `#[deprecated]` before removing APIs.
- **Changelog**: Maintain `CHANGELOG.md` (Keep a Changelog format).

## References

- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Effective Rust](https://www.lurklurk.org/effective-rust/)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [Clippy Lints](https://rust-lang.github.io/rust-clippy/master/)
