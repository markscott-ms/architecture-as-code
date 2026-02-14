# CALM Server (@finos/calm-server) - AI Assistant Guide

## Package Overview

**`@finos/calm-server`** is a standalone REST API server that provides HTTP endpoints for validating CALM architectures. It fulfills the requirements from [GitHub issue #2051](https://github.com/finos/architecture-as-code/issues/2051).

### Key Characteristics

- **Standalone executable**: Binary available as `calm-server` command
- **Library exports**: Also works as an npm library via `startServer()` function
- **Embedded schemas**: Uses built-in CALM meta-schemas (no filesystem loading)
- **Local-first security**: Binds to 127.0.0.1 by default; requires explicit `--bind` to expose
- **Lightweight**: Express.js-based REST API with minimal dependencies

## Project Structure

```
calm-server/
├── src/
│   ├── index.ts                 # CLI entry point, command parser, library exports
│   ├── server.ts                # Core server initialization (port, binding)
│   ├── routes/
│   │   ├── routes.ts            # Route coordinator class
│   │   ├── health-route.ts      # GET /health endpoint
│   │   ├── validation-route.ts  # POST /calm/validate endpoint
│   │   ├── routes.spec.ts       # Unit tests for route setup
│   │   ├── health-route.spec.ts # Health endpoint tests
│   │   └── validation-route.spec.ts # Validation endpoint tests
│   ├── server.integration.spec.ts # Integration tests (server startup)
│   └── server.e2e.spec.ts       # E2E tests (binary execution)
├── test_fixtures/
│   └── validation_route/        # Test JSON files for validation scenarios
│       ├── valid_instantiation.json
│       ├── invalid_api_gateway_instantiation_missing_schema_key.json
│       └── invalid_api_gateway_instantiation_schema_points_to_missing_schema.json
├── package.json                 # Package metadata, dependencies, scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vitest.config.ts             # Vitest test runner configuration
├── tsup.config.ts               # Build configuration (tsup/esbuild)
├── eslint.config.mjs            # Linting rules
├── README.md                     # User documentation
└── .gitignore                   # Git ignore patterns
```

## Architecture Patterns

### Express.js Route Architecture

The server uses a class-based route handler pattern:

```typescript
// Router class encapsulates HTTP handler logic
export class HealthRouter {
  constructor(router: Router) {
    router.get('/', this.healthCheck);
  }

  private healthCheck(_req: Request, res: Response) {
    res.status(200).type('json').send(new StatusResponse('OK'));
  }
}
```

**Why this pattern?**
- Encapsulation: Route logic contained in classes
- Testability: Easy to mock router and test handlers directly
- Composability: ServerRoutes aggregates all route handlers

### Dependency Injection

Routes depend on `SchemaDirectory` injected via constructor:

```typescript
new ValidationRouter(router, schemaDirectory, debug);
```

Allows:
- Testing with mock `SchemaDirectory`
- Using different schema sources without changing route logic
- Reusing routes in different server configurations

### Server Binding

The `startServer()` function accepts both address and port:

```typescript
function startServer(
  port: string | number,
  bindAddress: string,
  schemaDirectory: SchemaDirectory,
  verbose: boolean
): Server
```

Default binding to 127.0.0.1 enforces local-only access per security requirement.

## Key Implementation Details

### Embedded Schemas

Unlike the CLI, calm-server does NOT accept a `--schema-directory` argument. Instead, it uses the embedded CALM meta-schemas from `@finos/calm-shared`:

```typescript
const docLoader = new FileSystemDocumentLoader(
  [CALM_META_SCHEMA_DIRECTORY],  // Built-in schemas only
  false
);
const schemaDirectory = new SchemaDirectory(docLoader, verbose);
```

**Why?** Issue #2051 requirement: "it should not support filesystem based loading of any artifact"

### CLI Entry Point Strategy

The `index.ts` file serves two purposes:

1. **Executable**: When run as `calm-server`, it initializes schemas, starts server, handles signals
2. **Library**: Exports `startServer()` for programmatic use

```typescript
// Executable behavior
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}

// Library exports
export { startServer };
```

### Rate Limiting

Validation endpoint is protected by rate limiting middleware:

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per IP per window
});

router.use(limiter);
```

## Running the Server

### Development Mode

```bash
# Watch mode (rebuilds on file changes)
npm run watch --workspace calm-server

# In another terminal
npm run link:calm-server
calm-server --port 3000 --verbose
```

### Production Deployment

```bash
# Build
npm run build:calm-server

# Run (as system service or Docker container)
calm-server --bind 0.0.0.0 --port 3000
```

## Testing Patterns

### Unit Tests (routes.spec.ts, health-route.spec.ts)

Use mocked Express Router and dependencies:

```typescript
vi.mock('express', () => ({
  Router: vi.fn(() => mockRouter)
}));

// Test route class in isolation
it('should set up health route', () => {
  expect(HealthRouter).toHaveBeenCalled();
});
```

### Integration Tests (server.integration.spec.ts)

Start actual server, make HTTP requests, verify responses:

```typescript
const server = startServer(port, '127.0.0.1', schemaDirectory, false);
const response = await request(baseUrl).get('/health');
expect(response.status).toBe(200);
server.close();
```

### E2E Tests (server.e2e.spec.ts)

Spawn server as subprocess, test as external client:

```typescript
const serverProcess = spawn('node', [calmServerPath, '--port', '3002']);
const res = await axios.get('http://127.0.0.1:3002/health');
process.kill(-serverProcess.pid);
```

## Extending the Server

### Adding a New Endpoint

1. **Create route class** in `src/routes/new-route.ts`:

```typescript
import { Router, Request, Response } from 'express';

export class NewRouter {
  constructor(router: Router) {
    router.post('/path', this.handler);
  }

  private handler = async (req: Request, res: Response) => {
    // Handle request
    res.json({ result: 'data' });
  };
}
```

2. **Register in ServerRoutes** in `src/routes/routes.ts`:

```typescript
const newRoute = this.router.use('/new/path', this.router);
new NewRouter(newRoute);
```

3. **Add tests** in `src/routes/new-route.spec.ts`

### Modifying Request/Response

- Express request/response type helpers: `Request<ParamType, ResponseType>`
- Status codes: Use standard HTTP status (200, 201, 400, 500)
- Content-Type: Always use `.type('json')` for JSON responses
- Error responses: Wrap errors in `ErrorResponse` class

## Common Issues and Troubleshooting

### Port Already in Use

```bash
# Kill process using port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or use different port
calm-server --port 3001
```

### Schema Loading Failures

If schemas fail to load in testing:
- Check `CALM_META_SCHEMA_DIRECTORY` is defined in `@finos/calm-shared`
- Verify `calm-shared` is built: `npm run build:shared`
- Check FileSystemDocumentLoader has correct paths

### Binding Restrictions

Cannot bind to < 1024 without root:
```bash
# This fails without sudo
calm-server --bind 0.0.0.0 --port 80

# Use non-privileged port
calm-server --bind 0.0.0.0 --port 8080
```

## CI/CD Integration

The calm-server package integrates into the monorepo CI pipeline:

1. **Build**: `npm run build:calm-server` (includes models, widgets, shared)
2. **Test**: `npm test --workspace calm-server` (unit, integration, E2E)
3. **Lint**: `npm run lint --workspace calm-server`
4. **Release**: Semantic versioning and npm publishing

All tests must pass before merging to main.

## Related Resources

- **GitHub Issue**: [#2051 - CALM Server](https://github.com/finos/architecture-as-code/issues/2051)
- **CLI Package**: [cli/AGENTS.md](../cli/AGENTS.md) - similar patterns and structure
- **Shared Library**: [shared/](../shared) - validation logic and schemas
- **Express.js Docs**: https://expressjs.com/
- **Vitest Docs**: https://vitest.dev/

## License

Apache License 2.0
