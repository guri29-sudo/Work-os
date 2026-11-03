# WorkOS mobile responsiveness handoff

## Changes in this update

- Added a mobile/tablet responsive finishing layer while preserving the existing desktop styling.
- Standardized mobile viewport sizing around `100dvh` and safe-area insets.
- Reserved bottom-tab navigation space for all list-style views, not only Home.
- Made touch-only conversation header actions visible without hover.
- Tightened conversation header and composer sizing for narrow screens.
- Added safe-area-aware spacing for the bottom navigation and new-message floating action button.
- Made dialogs/drawers fit short screens and scroll within the viewport.
- Added narrow-screen stacking for community/content grids and horizontal scrolling for wide tables.
- Added tablet and landscape-phone adjustments.
- Added `min-h-0` / `min-w-0` to the main viewport flex region to reduce flex overflow.

## Validation performed

- Parsed the updated stylesheet with `tinycss2`: no CSS parse errors.
- Reviewed the affected React layout and mobile navigation conditions.
- A full Vite production build and real-device/browser visual test were not run in this environment because the ZIP does not include installed dependencies (`node_modules`) and package installation was not available.

## Recommended final QA

Check at 320x568, 360x800, 390x844, 430x932, 667x375 (landscape), 768x1024 and 1024x768:
- Home, Messages, Groups, Communities and Files
- Opening a conversation, going back, and switching conversations
- Message composer with the on-screen keyboard open
- Pinned messages, message actions, thread drawer and notifications
- Create group/channel/community dialogs
- Search, file preview, attachment selection and forwarding
- Bottom navigation and safe-area spacing on iOS/Android


## Follow-up repair: private groups + mobile visibility

- Private-group creation is now part of the standard `member` permission set, matching the expected collaboration workflow. Guest/read-only roles remain restricted.
- The mock web identities for Vedant and Sneha now carry the same private-group permission as the shared role defaults; the admin identity retains its management permissions.
- The API seed fallback for newly inserted admin/member identities now includes the corresponding private-channel capability. The API route continues enforcing `communication.private_channel.create`; no authorization check was removed.
- The MessagesWorkspace now has explicit `messages-workspace` and `data-workspace="messages"` hooks so responsive styles target the actual component.
- Added a second mobile finishing pass for dialog sizing/scrolling, safe-area spacing, form action visibility, compact phone widths, and tablet workspace sizing.

Validation performed: CSS parsed with zero syntax errors and targeted permission/workspace assertions passed. A full dependency install, TypeScript build, API integration test, and real iOS/Android browser test were not run in this environment.

## Mobile fix pass 3

- Groups, Create group and Communities were unreachable on phones (only in the desktop sidebar). Added them to the mobile "More" sheet.
- Replaced `h-screen`/`vh` with `h-dvh`/`dvh` so the bottom of the app is not hidden behind mobile browser bars.
- Added `viewport-fit=cover` so safe-area insets actually work on notched phones.
- Bottom tab bar + content offset + FAB now use one safe-area-aware set of classes (`mobile-nav`, `mobile-nav-offset`, `mobile-fab`); removed conflicting CSS that double-counted padding.
- Removed the blanket `.grid` single-column override that broke authored responsive grids.
- Conversation header actions (pins, settings) are always visible below `md`.
