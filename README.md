# Keap Resubscribe Service

Re-subscribes a Keap contact by submitting the Keap web form with Puppeteer.

## Endpoints

- `GET /`: health check
- `POST /resubscribe`: body `{ "email": "...", "first_name": "..." }`
  - Auth: `x-secret` header (preferred) or a `secret` field in the POST body
  - The secret is **never** accepted in the URL

## Environment variables (set in Railway, never in the repo)

| Name | Notes |
|---|---|
| `SECRET_KEY` | Required, at least 32 characters. Generate with `openssl rand -hex 32`. Seal it in Railway. |

`PORT` is provided automatically by Railway.

## Deploy (Railway)

Railway builds from the `Dockerfile` (see `railway.json`). Health check: `/`.
