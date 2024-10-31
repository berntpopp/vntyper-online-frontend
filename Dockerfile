# frontend/Dockerfile

FROM nginx:1.26.2-alpine-slim

RUN apk add --no-cache gettext bash

RUN rm -rf /usr/share/nginx/html/*

COPY . /usr/share/nginx/html/

EXPOSE 80
