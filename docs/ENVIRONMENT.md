# Environment Variables

All variables are validated with `zod` on startup. Missing or invalid required
variables cause the process to exit with a descriptive error.

## API (`apps/api`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `API_PORT` | No | `3001` | HTTP server port |
| `API_HOST` | No | `0.0.0.0` | HTTP server bind address |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `DATABASE_URL` | **Yes** | – | PostgreSQL connection string |
| `JWKS_URI` | **Yes** | – | JWKS endpoint URL for JWT verification |
| `JWT_AUDIENCE` | **Yes** | – | Expected `aud` claim in tokens |
| `JWT_ISSUER` | **Yes** | – | Expected `iss` claim in tokens |
| `STORAGE_ENDPOINT` | **Yes** | – | S3/MinIO endpoint URL |
| `STORAGE_ACCESS_KEY` | **Yes** | – | S3 access key |
| `STORAGE_SECRET_KEY` | **Yes** | – | S3 secret key |
| `STORAGE_BUCKET` | **Yes** | – | Attachment bucket name |
| `STORAGE_REGION` | No | `us-east-1` | S3 region |
| `CORS_ORIGINS` | **Yes** | – | Comma-separated allowed origins |
| `WEBHOOK_SIGNING_SECRET` | **Yes** | – | HMAC-SHA256 signing secret for webhooks |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window per user/IP |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in milliseconds |

## Mock IdP (`apps/mock-idp`) – DEV ONLY

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `MOCK_IDP_PORT` | No | `4001` | Server port |
| `MOCK_IDP_ISSUER` | No | `http://localhost:4001` | JWT `iss` claim |
| `JWT_AUDIENCE` | No | `communication-system` | JWT `aud` claim |
| `TOKEN_TTL_SECONDS` | No | `900` | Token lifetime in seconds (max 900) |

## Mock Webhook Receiver (`apps/mock-webhook`) – DEV ONLY

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `MOCK_WEBHOOK_PORT` | No | `4002` | Server port |
| `WEBHOOK_SIGNING_SECRET` | No | `dev_webhook_...` | Must match API signing secret |

## Frontend (`apps/web`)

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | API base URL |
| `VITE_WS_URL` | No | `ws://localhost:3001` | WebSocket URL |
| `VITE_MOCK_IDP_URL` | No | `http://localhost:4001` | Mock IdP URL (dev only) |
