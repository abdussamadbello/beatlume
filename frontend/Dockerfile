# Production Dockerfile - builds the SPA and serves it via Nginx.
# Local dev still uses Dockerfile.dev (referenced by backend/docker-compose.yml).

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL is inlined at build time — must be set as a build ARG.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx:alpine's docker-entrypoint runs envsubst on /etc/nginx/templates/*.template
# before launching nginx. The filter limits substitution to ${PORT} so we don't
# clobber nginx's own $uri / $host variables.
ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    NGINX_ENVSUBST_FILTER='^PORT$' \
    PORT=8080

EXPOSE 8080
