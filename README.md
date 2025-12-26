## GoCD MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with [GoCD](https://www.gocd.org/), a continuous delivery platform, through AI assistants.

This server enables AI assistants to query and manage GoCD pipelines, stages, and jobs via the MCP protocol. It acts as a bridge between AI tools and the GoCD REST API.

### Available Tools

#### Pipeline Management
- `list_pipelines` - Browse all pipelines with their groups and pause status
- `get_pipeline_status` - Check if a pipeline is running, paused, or locked
- `get_pipeline_history` - View recent pipeline runs and their results
- `get_pipeline_instance` - Get detailed information about a specific pipeline run
- `trigger_pipeline` - Manually start a pipeline run
- `pause_pipeline` / `unpause_pipeline` - Control pipeline scheduling

#### Stage Operations
- `get_stage_instance` - View stage details including all jobs and their status
- `trigger_stage` - Manually trigger or retry a stage
- `cancel_stage` - Stop a running stage

#### Job Analysis
- `parse_gocd_url` - Extract pipeline/stage/job info from GoCD URLs
- `analyze_job_failures` - Get comprehensive failure analysis including test results and console logs
- `get_job_history` - View job execution history
- `get_job_instance` - Check job status and details
- `get_job_console` - Read build logs and error output
- `list_job_artifacts` - Browse artifacts produced by a job
- `get_job_artifact` - Download specific artifact files
- `parse_junit_xml` - Extract structured test results from JUnit XML reports

#### Example Queries
- "Get all errors for this job <url>" - Automatically parses URL and analyzes failures
- "Show me why the build failed" - Finds test failures and build errors
- "List all pipelines" - Browse available pipelines
- "Trigger the deployment stage" - Manually run a stage

### GoCD API Compatibility

This MCP server integrates with the [GoCD REST API](https://api.gocd.org/current/) and is compatible with **GoCD 19.8.0 and later**.

The server uses the following GoCD API versions:
- **v1** - Pipeline status, history, instances, jobs
- **v2** - Stage triggering
- **v3** - Stage instances and cancellation
- **v4** - Dashboard and pipeline groups

For detailed API documentation, refer to the [GoCD API Reference](https://api.gocd.org/current/).

### Development

- `npm run dev`: Run in development mode with tsx
- `npm run build`: Compile TypeScript to JavaScript
- `npm run format`: Format code with Prettier
- `npm run inspect`: Open the MCP inspector for testing (server must be running separately)

The server will listen on the configured host and port (default: `http://0.0.0.0:3000`).

#### Configuration

Set the following environment variables on the server:

- `GOCD_SERVER_URL`: The URL of your GoCD server (e.g., `https://gocd.example.com`)
- `MCP_HOST`: Host to bind the MCP server to (default: `0.0.0.0`)
- `MCP_PORT`: Port for the MCP server to listen on (default: `3000`)

You can create a `.env` file in the project root:

```env
GOCD_SERVER_URL=https://your-gocd-server.com
MCP_HOST=0.0.0.0
MCP_PORT=3000
```

**Note:** Users connecting to the MCP server will provide their own GoCD API token when authenticating. The server does not require a shared token.

#### Debug Logging

Enable debug output using the `DEBUG` environment variable:

```bash
# Enable all debug logs
DEBUG=gocd-mcp:* npm run dev

# Enable specific namespaces
DEBUG=gocd-mcp:tools,gocd-mcp:client npm run dev

# With Docker
docker run -d -e DEBUG=gocd-mcp:* --env-file=.env -p 3000:3000 gocd-mcp
```

Available namespaces:
- `gocd-mcp:server` - Server startup and shutdown
- `gocd-mcp:http` - HTTP requests to the MCP endpoint
- `gocd-mcp:session` - MCP session lifecycle
- `gocd-mcp:tools` - Tool calls and dispatch
- `gocd-mcp:client` - GoCD API requests

### Deployment

A `Dockerfile` has been added to this repository you can use it to run the server. Create your `.env` with the configuration and 

```bash
docker build -t gocd-mcp .
docker run -d --env-file=.env -p <YOUR_LOCAL_PORT>:<MCP_PORT> gocd-mcp

# With debug logging enabled
docker run -d -e DEBUG=gocd-mcp:* --env-file=.env -p <YOUR_LOCAL_PORT>:<MCP_PORT> gocd-mcp
```

#### Testing

```bash
npm test
```

**Testing with MCP Inspector**

1. Start the server: `npm run dev`
2. Open the inspector: `npm run inspect`
3. In the inspector UI, connect to: `http://localhost:3000/mcp`
4. Add header: `Authorization: Bearer YOUR_GOCD_API_TOKEN`

### Connecting GoCD MCP to your AI

The server communicates via HTTP and exposes the MCP protocol at the `/mcp` endpoint. Users authenticate by providing their GoCD API token as a Bearer token.

**Claude Code**

Add this server to your Claude Code configuration file (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "gocd": {
      "url": "https://your-mcp-server-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_GOCD_API_TOKEN"
      }
    }
  }
}
```

**GitHub Copilot (VS Code)**

Add this server to your Copilot settings:

1. Open VS Code Settings (JSON)
2. Add the MCP server configuration:

```json
{
  "github.copilot.chat.mcp.servers": {
    "gocd": {
      "url": "https://your-mcp-server-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_GOCD_API_TOKEN"
      }
    }
  }
}
```

**Important:**
- Replace `https://your-mcp-server-domain.com` with the actual URL where your GoCD MCP server is hosted (e.g., `http://localhost:3000` for local development)
- Replace `YOUR_GOCD_API_TOKEN` with your personal [GoCD API token](https://docs.gocd.org/current/configuration/access_tokens.html) (generate from GoCD: User Menu > Personal Access Tokens)
- Each user provides their own GoCD API token for authentication


### Troubleshooting

**"Server not initialized" Error**

This error typically occurs when the MCP session is not properly established. To fix:

1. Ensure the server is running (`npm run dev`)
2. Disconnect and reconnect in your MCP client
3. Verify you're connecting to the correct endpoint: `http://localhost:3000/mcp`
4. Make sure you've included the `Authorization` header with your Bearer token

**Authentication Failed**

If you receive an "UNAUTHORIZED" error:

1. Verify your GoCD API token is valid
2. Check the token has the necessary permissions in GoCD
3. Ensure the Authorization header is properly formatted: `Bearer YOUR_TOKEN`
4. Generate a new token from GoCD (User Menu > Personal Access Tokens)

**Connection Refused**

If you cannot connect to the server:

1. Check the server is running: `curl http://localhost:3000/health`
2. Verify `MCP_HOST` and `MCP_PORT` in your `.env` file
3. Check for port conflicts - ensure port 3000 is available
4. If hosting remotely, ensure firewall rules allow the connection

**GoCD API Errors**

If you receive errors from the GoCD API:

1. Verify `GOCD_SERVER_URL` is correct in your `.env` file
2. Ensure the GoCD server is accessible from the MCP server
3. Check your GoCD server version is 19.8.0 or later
4. Verify the pipeline/stage/job names are correct

### Requirements

- Node.js >= 18.0.0 (v22+ recommended for security)

### Author

Rushi Vishavadia
