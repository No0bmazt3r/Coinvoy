# The ML service (engine, BM classifier, Penyata PDF). Private: only the API talks to it. Build context: the repo root.
FROM python:3.12-slim
# WeasyPrint needs Pango and HarfBuzz; DejaVu covers BM text in the PDF.
RUN apt-get update && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv==0.13.1
WORKDIR /app/ml
COPY ml/pyproject.toml ml/uv.lock ./
RUN uv sync --frozen --no-dev
COPY ml/ ./
COPY frontend/public/logo.png /app/frontend/public/logo.png
RUN useradd --create-home app && chown -R app /app
USER app
EXPOSE 8001
CMD ["uv", "run", "--no-dev", "--frozen", "uvicorn", "app.service:app", "--host", "0.0.0.0", "--port", "8001"]
