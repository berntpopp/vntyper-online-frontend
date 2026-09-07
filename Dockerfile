# frontend/Dockerfile

FROM nginx:1.31.5-alpine-slim

# Upgrade packages to patch OS vulnerabilities and install gettext, bash, and curl for health checks
RUN apk update && apk upgrade --no-cache && apk add --no-cache gettext bash curl

RUN rm -rf /usr/share/nginx/html/*

# Allow-list the web root.
#
# `COPY .` published every repository file that .dockerignore happened not to
# name - package manifests, Makefile, ESLint/vitest config, the test suite and
# CI workflows - and exposed every future file by default. Copy only what the
# site actually serves.
COPY index.html adtkd_diagnostics.html contact.html      impressum_en.html impressum_de.html donate.html      robots.txt sitemap.xml /usr/share/nginx/html/
COPY resources/ /usr/share/nginx/html/resources/

EXPOSE 80

# Add HEALTHCHECK to ensure frontend is responding
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD curl -f http://localhost || exit 1
