# Member Commerce and Owner Navigation Design

## Goal

Make the existing Astera OMS member flow discoverable without changing its
commerce rules: members can find payment reporting after ordering, shoppers can
open a compact cart from the shared header, and Owners can reach protected
workspace and content management from their signed-in account controls.

## Scope and constraints

- Keep `productsPublic` as the public product source.
- Keep the existing Firebase Authentication flow and Custom Claim role source.
- Do not change Firestore collections, Rules, Checkout server validation, price
  calculation, Order splitting, or Payment APIs.
- Do not create Orders, Payment reports, or other business records during UI
  verification.
- Use the current Astera tokens, 44px minimum interactive controls, keyboard
  focus states, and reduced-motion behavior.

## 1. Post-order payment reporting

`/payments` remains the only member Payment Report page. The member order list
and order detail surface will add a clear `前往付款回報` link only for orders that
still have a payment request awaiting member action. The link uses the existing
payment page and a request identifier query parameter; the payment board reads
the parameter only to preselect the matching pending request. The server still
authoritatively verifies the member owns every selected request.

Orders with no actionable payment request do not show the link. The payment
board keeps its existing multi-request selection so one member transfer can be
reported against multiple eligible orders.

## 2. Header mini-cart drawer

The existing header cart entry becomes a button with the current cart quantity.
Selecting it opens a right-side drawer that contains the existing anonymous or
member cart items, item count, total, and two links: `查看購物車` (`/cart`) and
`前往結帳` (`/checkout`). The full item list remains in the drawer, while editing
quantity and removal stays on `/cart`; this prevents duplicated cart-write logic.

The drawer closes through an explicit close button, overlay click, Escape, or
route navigation. It traps neither authentication nor payment content. It is
accessible as a labelled dialog, has visible focus, reserves 44px controls, and
uses the project reduced-motion rule for its transition.

Signed-out visitors can view the drawer but follow the existing protected-cart
behavior when taking cart-writing or checkout actions. The drawer reads the same
anonymous cart storage and protected `/api/cart` synchronization already used by
`CartBoard`; it never reads `productsInternal`.

## 3. Owner workspace discovery

`AccountActions` will read the existing `role` from `useAuth`. Only `owner` sees
the `管理後台` link to `/workspace`; `helper` and `member` do not receive an
Owner-management affordance. The `/workspace` layout remains the security gate,
so hiding the link is not relied on for authorization.

The workspace dashboard will add a `品牌內容 Content` card linking to
`/workspace/content`, alongside its existing products, members, orders, and
payments cards.

## 4. Brand announcements and FAQ

The existing protected Owner page `/workspace/content` is the single authoring
surface. It retains its existing API and Server validation. The visible UI labels
will make the process explicit:

1. Choose `新增公告` or `新增 FAQ`.
2. Fill the title/body or question/answer, choose draft or published, then save.
3. Published items appear on `/brand`; drafts remain private to the workspace.

The Owner entry points described above make this existing functionality
discoverable without exposing content editing to public visitors, helpers, or
members.

## Files and boundaries

- `src/components/auth/AccountActions.tsx`: role-aware Owner workspace link.
- `src/components/storefront/StorefrontHeader.tsx` and a focused mini-cart drawer
  component: shared cart trigger and presentation only.
- `src/lib/cart/*`: reuse existing cart read/synchronization helpers; no new
  persistence model.
- `src/components/storefront/OrderHistoryBoard.tsx` and order detail component:
  contextual payment-report links.
- `src/components/storefront/PaymentRequestsBoard.tsx`: optional preselection of
  an existing request, validated against the member-owned list.
- `src/app/workspace/page.tsx`: Content dashboard card.
- `src/components/workspace/ContentOperationsBoard.tsx`: clearer authoring helper
  copy only, retaining existing protected API.

## Verification

- Unit tests prove Owner-only account navigation, actionable-order payment links,
  and request-query preselection ignores missing, foreign, or non-actionable IDs.
- Playwright covers desktop and mobile drawer open/close, keyboard Escape, no
  horizontal overflow, member checkout navigation, Owner workspace visibility,
  and content management access.
- Run TypeScript, ESLint, full Unit, Build, public Playwright, and relevant
  authenticated Emulator Playwright before deployment.
