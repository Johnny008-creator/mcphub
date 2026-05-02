FROM node:20-slim

# Install git for the scorer
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package.json for workspace support
COPY package.json .
COPY scorer/package.json scorer/

RUN npm install -w scorer

COPY scorer/ scorer/
COPY registry/db.js registry/db.js

CMD ["npm", "run", "scorer"]
