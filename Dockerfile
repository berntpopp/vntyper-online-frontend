# frontend/Dockerfile

# Use the official Nginx image
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Remove the default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy all frontend static files to Nginx's HTML directory
COPY . /usr/share/nginx/html/

# Copy the shell script
COPY generate_config.sh /generate_config.sh

# Make the shell script executable
RUN chmod +x /generate_config.sh

# Expose port 80
EXPOSE 80

# Set the entrypoint to the shell script
ENTRYPOINT ["/generate_config.sh", "-l", "-c" ]