#!/bin/sh

# first remove the existing config.js
rm -f /usr/share/nginx/html/ressources/js/config.js

# Replace the placeholder in config.template.js with the actual API URL
envsubst < /usr/share/nginx/html/ressources/js/config.template.js > /usr/share/nginx/html/ressources/js/config.js

# Start Nginx
nginx -g 'daemon off;'
