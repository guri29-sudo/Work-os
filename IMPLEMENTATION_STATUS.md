# WorkOS implementation status (handoff)

## Included in this update

- Updated the group creation modal to use the same charcoal/violet visual language as the supplied chat reference.
- Added a searchable member picker to the group creation flow.
- Fixed the Communities page's **Create group** action so it opens the modal in **Private group** mode rather than accidentally opening a public channel form.
- Added a dedicated **Create group** shortcut in the workspace navigation.
- Added a distinct `/app/groups/:id` deep-link shape for private group conversations, including refresh and browser back/forward route handling.
- Group conversation back navigation returns to the Group chats list.
- Kept the existing message actions (pin/unpin, edit, delete, forward, copy) and existing backend source intact.
- Preserved responsive layout rules and added accessible dialog semantics to the group/channel creation modal.

## Important implementation boundary

This repository's current frontend communication engine (`apps/web/src/packages/sdk/client.ts`) is a browser-side fixture engine. It seeds conversations and messages from `apps/web/src/packages/test-fixtures/fixtures.ts` and persists changes to `localStorage`/`sessionStorage`. Its BroadcastChannel support synchronizes browser tabs, not separate users over the server. The new Communities view also stores community records in browser `localStorage`.

The repository does contain a Fastify/PostgreSQL API for channels and messages, but this frontend is not yet wired to those API endpoints. The existing API also does not currently expose complete community CRUD/membership endpoints or pinned-message endpoints. Consequently, this package must **not** be described as a production-ready, multi-user implementation of these features yet.

## Feature status

| Feature | Current state | Remaining production work |
|---|---|---|
| Pin / unpin | Existing browser-engine action and pinned-message UI | Persist through API/database and publish realtime events |
| Edit | Existing browser-engine action, own-message permission check, edited label | Wire API mutation and realtime events from server |
| Delete | Existing browser-engine soft-delete behavior and confirmation flow | Wire API mutation and synchronize delete events |
| Forward | Existing browser-engine forwarding flow and destination picker | Store forwarded records through API and preserve structured attribution |
| Copy | Existing clipboard action | Browser permission/error handling should be verified in target browsers |
| Group creation | Private-channel/group creation flow with member picker | Replace fixture member directory with authenticated users API; persist membership through API |
| Communities | Create/list/detail and attach existing group IDs in this browser | Add community, membership, invitation, roles, and group-association database/API operations |
| Routing | URL-backed app navigation for main views and group conversation deep links | A complete router with route guards, 404 page and server history fallback still needs to be completed |
| Responsive UI | Existing adaptive two-pane workspace plus mobile CSS and modal sizing | Device/browser QA at the requested viewport widths is still required |

## Verification performed

- TypeScript compiler parser check on the two edited TSX files: no TS syntax diagnostics were reported.
- Full typecheck/build could not be completed because project dependencies are not installed in this environment. `tsc` reports the missing `vite/client` type package; offline package installation could not fetch the pinned pnpm runtime because network access to the npm registry was unavailable.
- API/database integration tests and multi-user realtime tests were not run.
- Physical iOS/Android device tests were not run.

## Run locally

From the repository root, use the package manager version pinned in `package.json` / `packageManager` and install dependencies, then run the documented workspace scripts. Configure the API and identity-provider environment variables from `.env.example` and `DEPLOY.md` before expecting server-backed behavior.

Do not deploy this as a production multi-user system until the frontend is connected to the API and the missing community/pin APIs, migrations, authorization checks, and realtime events are implemented and tested.
