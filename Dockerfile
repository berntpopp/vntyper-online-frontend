# frontend/Dockerfile

# Use the official Nginx image
FROM nginx:alpine

# Remove the default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the frontend files to Nginx's HTML directory
COPY index.html /usr/share/nginx/html/

# Optionally, copy other assets like CSS, JS, images if they exist
# COPY assets/ /usr/share/nginx/html/assets/

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
