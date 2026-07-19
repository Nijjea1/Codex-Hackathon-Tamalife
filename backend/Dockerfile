# Single image for the API (and, later, Celery worker/beat via different
# entrypoints — design doc §14). Uses uv for fast, reproducible installs.
FROM python:3.12-slim

# uv: fast Python package manager. Copied from its official image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install dependencies first (better layer caching) using only the manifests.
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

# Then copy the application code.
COPY app ./app

EXPOSE 8000

# Production entrypoint. docker-compose overrides this with --reload for dev.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
