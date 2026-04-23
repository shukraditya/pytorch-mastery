FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY problems/ ./problems/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
