# frontend/Dockerfile

FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext bash

# Remove the default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy all frontend static files to Nginx's HTML directory
COPY . /usr/share/nginx/html/

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the shell script
COPY generate_config.sh /generate_config.sh

# Make the shell script executable
RUN chmod +x /generate_config.sh

# Expose port 80
EXPOSE 80

# Set the entrypoint to the shell script
CMD ["/bin/sh", "/generate_config.sh"]
