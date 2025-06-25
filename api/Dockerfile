# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Install system dependencies required for TeX Live
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-full \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Your app binds to port 3001, but Vercel will handle mapping
EXPOSE 3001

# Define the command to run your app
CMD ["node", "index.js"]
