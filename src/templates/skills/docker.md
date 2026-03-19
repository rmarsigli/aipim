### Skill: Docker Guidelines
- **Layer Caching**: Order `Dockerfile` instructions from least to most frequently changed. Copy dependency manifests (`package.json`, `requirements.txt`) and install before copying source code.
- **Multi-Stage Builds**: Use multi-stage builds to separate build-time dependencies from the final runtime image. The production image must not contain compilers, dev tools, or test dependencies.
- **Non-Root User**: Always run the application process as a non-root user. Add `USER appuser` after installing dependencies.
- **`.dockerignore`**: Maintain a `.dockerignore` file. Exclude `node_modules`, `.git`, test files, and local env files to keep the build context small and prevent secrets leaking into the image.
- **Explicit Tags**: Never use `latest` for base images in production `Dockerfile`s. Pin to a specific version (`node:22.4-alpine3.20`) for reproducible builds.
- **Minimal Base Images**: Prefer `alpine` or `distroless` variants for production images. Avoid `ubuntu`/`debian` full images unless a dependency requires them.
- **Secrets at Runtime**: Never bake secrets into images via `ENV` or `ARG`. Inject secrets at runtime via environment variables or mounted secret volumes.
- **Health Checks**: Define a `HEALTHCHECK` instruction for long-running service containers so orchestrators can detect and replace unhealthy instances.
