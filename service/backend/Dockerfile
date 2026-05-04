FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright
# These libraries are required for Chromium to run in headless mode
RUN apt-get update && apt-get install -y \
    # Basic utilities
    wget \
    gnupg \
    curl \
    # Node.js for Playwright CLI
    nodejs \
    npm \
    # GTK and graphics libraries
    libglib2.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    # Audio and D-Bus
    libasound2 \
    libatspi2.0-0 \
    libdbus-1-3 \
    # Network and security
    libnss3 \
    libnspr4 \
    # X11 libraries
    libx11-6 \
    libxcb1 \
    libexpat1 \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user first
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Install Playwright browsers as non-root user
USER appuser
RUN playwright install chromium

# Copy application code
COPY . --chown=appuser:appuser

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
