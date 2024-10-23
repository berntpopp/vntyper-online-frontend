#!/bin/sh

# Replace the placeholder in config.template.js with the actual API URL
envsubst < /usr/share/nginx/html/ressources/js/config.template.js > /usr/share/nginx/html/ressources/js/config.js

# Start Nginx
nginx -g 'daemon off;'
