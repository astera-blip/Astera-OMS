# Preview Same-Origin Firebase Auth Design

## Goal

Restore Google redirect sign-in on the stable Vercel Preview hostname without
weakening Firebase Authentication, adding a new authorized domain, or changing
Production.

## Confirmed problem

The stable Preview application is served by Vercel while Firebase Auth uses the
Firebase-hosted `authDomain`. The redirect helper therefore relies on cross-origin
storage. Browser privacy controls can discard that state: Google account selection
completes, but the app returns signed out. Direct redirect is retained because it
works reliably on mobile; popup sign-in was removed because it flashes or is
blocked there.

## Approved design

1. Add one Next.js external `beforeFiles` rewrite:
   `/__/auth/:path*` transparently proxies to the existing Firebase Auth helper
   under `https://astera-oms-prod.firebaseapp.com/__/auth/:path*`.
2. Set only the Vercel **Preview** value of
   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to the existing stable Preview hostname.
   Keep the Firebase API key, project ID, app ID, and all other Firebase values
   unchanged.
3. The existing Firebase Authorized Domain remains the only Preview domain. Do not
   add one-off deployment URLs.
4. Deploy Preview only, assign the stable alias to the Ready deployment, and test
   Google account selection followed by a retained authenticated state on
   `/account/bank-accounts`.

## Boundaries

- No Production deployment, Production Vercel environment mutation, Firebase
  Authorized Domain mutation, account/order/payment/refund test data, or Auth
  bypass is in scope.
- The proxy is transparent: it must be a rewrite, never a 302 redirect.
- A failed retest stops the acceptance flow and records the observed Firebase error
  without reading browser storage, cookies, tokens, account digits, or secrets.

## Verification

- Unit regression test inspects `next.config.ts` for an external
  `beforeFiles` rewrite with the exact auth path and Firebase destination.
- Existing focused unit suite, TypeScript, ESLint, Next build, secret scan, and
  diff check must pass before push.
- Vercel Preview must be Ready before the stable alias is moved.
- Manual browser result is successful only when the user remains signed in after
  returning from Google and navigating to `/account/bank-accounts`.

## Rejected alternatives

- Keep the cross-origin Firebase helper: known to fail on storage-partitioned
  mobile/in-app browsers.
- Reintroduce popup sign-in: avoids the helper-state issue but reintroduces the
  reported popup flash/blocking behaviour on mobile.
- Self-host Firebase helper files or introduce a new production custom domain:
  wider operational scope than the approved Preview remediation.
