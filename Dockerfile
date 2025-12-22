# Use an official Node.js runtime as a parent image
FROM node:22-slim

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# to leverage Docker cache for npm install
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the TypeScript application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3999

# Run the application
CMD [ "npm", "start" ]
