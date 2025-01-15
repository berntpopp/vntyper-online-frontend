# frontend/Dockerfile

FROM nginx:1.26.2-alpine-slim

# Install gettext, bash, and curl for health checks
RUN apk add --no-cache gettext bash curl

RUN rm -rf /usr/share/nginx/html/*

COPY . /usr/share/nginx/html/

EXPOSE 80

# Add HEALTHCHECK to ensure frontend is responding
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD curl -f http://localhost || exit 1
