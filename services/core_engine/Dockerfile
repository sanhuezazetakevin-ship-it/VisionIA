FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN sed 's/^opencv-python>=/opencv-python-headless>=/' requirements.txt > /tmp/requirements-headless.txt \
    && pip install --no-cache-dir -r /tmp/requirements-headless.txt \
    && rm -f /tmp/requirements-headless.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
