# ===== Build stage =====
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Build the app
COPY . .
# If you need build-time envs (e.g., VITE_API_BASE_URL), set them via compose build args or .env
RUN npm run build

# ===== Serve stage =====
FROM nginx:alpine

# Replace default server config with our SPA config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Run NGINX in foreground
CMD ["nginx", "-g", "daemon off;"]
