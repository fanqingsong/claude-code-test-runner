FROM node:20-alpine

WORKDIR /app/frontend

# Set environment to development
ENV NODE_ENV=development

# Copy frontend package files
COPY src/package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy all frontend source files
COPY src/ ./

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
