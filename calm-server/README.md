# @finos/calm-server

REST API server for validating CALM architectures and patterns.

## Overview

`@finos/calm-server` is a standalone HTTP server that exposes CALM validation functionality via a simple REST API. It allows external systems to validate CALM architectures and patterns without needing to install or run the full CLI tool.

**Key features:**
- Health check endpoint (`GET /health`)
- Architecture validation endpoint (`POST /calm/validate`)
- Built-in CALM meta-schemas (no filesystem configuration required)
- Rate limiting on validation endpoints (100 requests per 15 minutes per IP)
- Local-only binding by default (127.0.0.1) with optional expansion

## Installation

### As a global binary

```bash
npm install -g @finos/calm-server
calm-server --port 3000
```

### As a workspace dependency (development)

```bash
npm run build:calm-server
npm run link:calm-server
calm-server --port 3000
```

### As a library in your Node.js project

```bash
npm install @finos/calm-server
```

```javascript
import { startServer } from '@finos/calm-server';
import { SchemaDirectory } from '@finos/calm-shared';
import { FileSystemDocumentLoader } from '@finos/calm-shared/dist/document-loader/file-system-document-loader';
import { CALM_META_SCHEMA_DIRECTORY } from '@finos/calm-shared';

const docLoader = new FileSystemDocumentLoader([CALM_META_SCHEMA_DIRECTORY], false);
const schemaDirectory = new SchemaDirectory(docLoader, false);
const server = startServer(3000, '127.0.0.1', schemaDirectory, false);
```

## Usage

### Command-line options

```bash
calm-server [options]

Options:
  -p, --port <number>      Port to listen on (default: 3000)
  -b, --bind <address>     Bind address (default: 127.0.0.1)
  -v, --verbose            Enable verbose logging
  -h, --help               Show help message
  --version                Show version
```

### Examples

**Start on default port (3000) with local-only binding:**

```bash
calm-server
```

**Start on port 8080:**

```bash
calm-server --port 8080
```

**Bind to all network interfaces (with security warning):**

```bash
calm-server --bind 0.0.0.0
```

⚠️ **Warning**: When binding to interfaces other than 127.0.0.1, the server will emit a warning that no authentication or authorization is provided. Ensure your network security is properly configured.

## API Endpoints

### GET /health

Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "OK"
}
```

### POST /calm/validate

Validate a CALM architecture.

**Request body:**
```json
{
  "architecture": "{\"$schema\": \"...\", \"nodes\": [...], ...}"
}
```

**Response (201 Created):**
```json
{
  "jsonSchemaValidationOutputs": [...],
  "spectralSchemaValidationOutputs": [...],
  "hasErrors": false,
  "hasWarnings": false
}
```

**Error responses:**
- `400 Bad Request`: Missing `$schema` field, invalid schema reference, or malformed JSON
- `500 Internal Server Error`: Schema loading or validation processing errors

## Security Considerations

- **Default binding**: The server listens on `127.0.0.1` (loopback only) by default for security.
- **No authentication**: This server provides no built-in authentication or authorization. When exposed to other interfaces, network-level security must be implemented (firewall rules, VPN, etc.).
- **Rate limiting**: Validation endpoints are rate limited to 100 requests per 15 minutes per IP address.
- **No file uploads**: The server does not support filesystem-based artifact loading. Only JSON in request bodies is accepted.

## Development

### Building

```bash
npm run build --workspace calm-server
```

### Testing

```bash
npm test --workspace calm-server
npm run test:coverage --workspace calm-server
```

### Linting

```bash
npm run lint --workspace calm-server
npm run lint-fix --workspace calm-server
```

### Watch mode

```bash
npm run watch --workspace calm-server
```

## Related Documentation

- [Issue #2051: CALM Server](https://github.com/finos/architecture-as-code/issues/2051)
- [CALM CLI `@finos/calm-cli`](../cli/README.md)
- [CALM Shared `@finos/calm-shared`](../shared)

## License

Apache License 2.0
