# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Added
- Stage 1: Monorepo scaffold, tooling, contracts package, mock IdP, RBAC docs

## [0.1.0] - 2026-10-23

### Added
- Initial monorepo setup with pnpm workspaces and Turborepo
- `packages/contracts`: Zod schemas for permissions, JWT claims, entities, API, events, webhooks
- `packages/test-fixtures`: 2 synthetic companies, 10 synthetic users, channel definitions
- `apps/mock-idp`: Dev-only JWT issuer with JWKS endpoint and key rotation support
- `apps/mock-webhook`: Dev-only webhook receiver with signature verification
- GitHub Actions CI workflow
- Docker Compose for full local stack
- Documentation: ARCHITECTURE, RBAC, DECISIONS, ENVIRONMENT, THIRD_PARTY_LICENSES
