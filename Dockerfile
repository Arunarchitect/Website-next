# Use the official Node.js image from Docker Hub as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) to the container
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of the application files to the container
COPY . .

# Install TypeScript globally
RUN npm install -g typescript

# Build the Next.js application (this will also compile TypeScript files)
RUN npm run build

# Expose the port the app will run on (default for Next.js is 3000)
EXPOSE 3000

# Start the Next.js app in production mode
CMD ["npm", "start"]