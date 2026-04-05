# Use Node 22 for native TypeScript support
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build arguments for API keys (needed during vite build)
ARG GEMINI_API_KEY
ARG GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_API_KEY
ARG CUSTOM_GEMINI_KEY

# Set environment variables for the build process
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV CUSTOM_GEMINI_KEY=$CUSTOM_GEMINI_KEY

# Build the frontend
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/firebase-applet-config.json ./

# Expose the port (Cloud Run uses $PORT)
EXPOSE 3000

# Start the server
CMD ["npx", "tsx", "server.ts"]
