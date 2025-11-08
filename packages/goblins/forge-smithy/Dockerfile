FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project files
COPY pyproject.toml ./
COPY smithy/ ./smithy/

# Install dependencies
RUN uv pip install --system -e .

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8002/health')" || exit 1

# Run the FastAPI service
CMD ["uvicorn", "smithy.service:app", "--host", "0.0.0.0", "--port", "8002"]
