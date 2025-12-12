# GoCD MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with [GoCD](https://www.gocd.org/), a continuous delivery platform, through AI assistants.

## Description

This server enables AI assistants to query and manage GoCD pipelines, stages, and jobs via the MCP protocol. It acts as a bridge between AI tools and the GoCD REST API.

## Features

- **Pipeline Tools**: Query pipeline information, history, and status
- **Stage Tools**: Manage and monitor pipeline stages
- **Job Tools**: Access job details and execution status

## GoCD API Compatibility

This MCP server integrates with the [GoCD REST API](https://api.gocd.org/current/) and is compatible with **GoCD 19.8.0 and later**.

The server uses the following GoCD API versions:
- **v1** - Pipeline status, history, instances, jobs
- **v2** - Stage triggering
- **v3** - Stage instances and cancellation
- **v4** - Dashboard and pipeline groups

For detailed API documentation, refer to the [GoCD API Reference](https://api.gocd.org/current/).

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Set the following environment variables:

- `GOCD_SERVER_URL`: The URL of your GoCD server (e.g., `https://gocd.example.com`)
- `GOCD_API_TOKEN`: Your [GoCD API token](https://docs.gocd.org/current/configuration/access_tokens.html) for authentication

You can create a `.env` file in the project root:

```env
GOCD_SERVER_URL=https://your-gocd-server.com
GOCD_API_TOKEN=your-api-token-here
```

## Usage

### Running the Server

Start the server in development mode:
```bash
npm run dev
```

Or run the built version:
```bash
npm start
```

### Connecting to MCP Clients

The server communicates via stdio and can be integrated with MCP-compatible clients like Claude Desktop or other AI assistants that support the Model Context Protocol.

For inspection and testing:
```bash
npm run inspect
```

## Development

- `npm run dev`: Run in development mode with tsx
- `npm run build`: Compile TypeScript to JavaScript
- `npm run format`: Format code with Prettier
- `npm run inspect`: Run the MCP inspector for testing

### Testing

Run tests:
```bash
npm test
```

## Requirements

- Node.js >= 18.0.0

## Author

Rushi Vishavadia
