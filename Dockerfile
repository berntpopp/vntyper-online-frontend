# frontend/Dockerfile

FROM nginx:alpine

RUN apk add --no-cache gettext bash

RUN rm -rf /usr/share/nginx/html/*

COPY . /usr/share/nginx/html/

RUN chmod +x /generate_config.sh

EXPOSE 80
