FROM node:20-slim

WORKDIR /app

# Copy root package.json for workspace support
COPY package.json .
COPY registry/package.json registry/

RUN npm install -w registry

COPY registry/ registry/
COPY web/ web/

EXPOSE 3000

CMD ["npm", "start", "-w", "registry"]
