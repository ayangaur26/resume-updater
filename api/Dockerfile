# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set an environment variable to prevent it from asking for user input during installation.
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies required for TeX Live.
# This is a large package and will increase the build time on Vercel, which is normal.
# We also clean up apt-get lists to reduce the final image size.
RUN apt-get update && apt-get install -y --no-install-recommends texlive-full && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory to Vercel's standard directory.
WORKDIR /var/task

# Copy package.json and package-lock.json first to leverage Docker's layer caching.
COPY package*.json ./

# Install Node.js dependencies.
RUN npm install --production

# Copy the rest of your application's code into the container.
COPY . .

# The command to run when the container starts. Vercel will use this.
CMD ["node", "index.js"]
