# MCPHub 📦

An open-source MCP (Model Context Protocol) server registry with automated quality scoring.

## Features

- **Registry API**: Submit and discover MCP servers via a RESTful API.
- **Automated Quality Scoring**: Evaluates servers based on README quality, handshake success, tool schemas, performance, and security.
- **CLI Tool**: Search, info, install, and publish MCP servers from your terminal.
- **Single-Page Frontend**: Browse and submit servers through a modern dark-themed web interface.
- **Zero-Dependency Core**: Runs on Node.js and SQLite.

## Scoring Criteria (Max 100)

- **README Quality (+20)**: Checks for presence of README.md and tool descriptions.
- **MCP Handshake (+25)**: Validates if the server responds to the `initialize` JSON-RPC message.
- **Tool Schemas (+20)**: Checks if tools provided have valid JSON input schemas.
- **Response Speed (+15)**: Awards points for response times under 2 seconds.
- **Versioning (+10)**: Checks for `package.json` or `CHANGELOG.md`.
- **Security Scan (+10)**: Scans for common hardcoded secrets in the repository.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Docker & Docker Compose (optional, for containerized run)

### Running with Docker

```bash
docker-compose up --build
```

The registry will be available at `http://localhost:3000`.

### Local Development

1. Install root dependencies:
   ```bash
   npm install
   ```

2. Start the Registry:
   ```bash
   npm start
   ```

3. Start the Scorer:
   ```bash
   npm run scorer
   ```

## CLI Usage

Install the CLI globally (locally from the `cli` folder for development):

```bash
cd cli
npm link
```

Commands:

```bash
mcphub search "weather"
mcphub info 1
mcphub install 1
mcphub publish https://github.com/example/my-mcp-server.git
mcphub score 1
```

## Structure

- `/registry`: Node.js Express API & SQLite Database logic.
- `/web`: Vanilla HTML/JS/CSS frontend.
- `/cli`: Node.js-based CLI tool.
- `/scorer`: Background worker for quality scoring.

## License

MIT
