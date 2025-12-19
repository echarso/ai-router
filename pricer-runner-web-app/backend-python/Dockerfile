FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Copy secrets.yaml if it exists (for local development)
# In production, use Kubernetes secrets or environment variables
COPY ../../secrets.yaml* ./

EXPOSE 3001

CMD ["python", "app.py"]

