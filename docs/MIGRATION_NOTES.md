# Migration Notes

## v0.1.x ? v0.2.x (Stage 2)
- DB schema introduced; run `pnpm --filter @cs/api db:migrate` before starting API
- No breaking API changes (API not yet implemented)

## Breaking Changes Policy
- Breaking API changes require a new version prefix (`/v2`)
- DB migrations are always additive in minor versions; destructive only in major
- WebSocket event schema changes bump the `v` field
