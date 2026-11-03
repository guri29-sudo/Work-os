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
