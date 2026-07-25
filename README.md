# Astera OMS

Astera OMS is a Thai GL and artist merchandise preorder commerce system plus internal operations workspace. The MVP will start with a safe storefront, Google login, member profiles, product management, order management, manual bank-transfer payment confirmation, and basic security/audit foundations.

## Current Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- ESLint
- Planned: Firebase Authentication, Firestore, Storage, Cloud Functions or protected server APIs

## Local Development

Use Node.js LTS. Day 1 was verified with Node.js `v24.18.0` and npm `11.16.0`.

Start the development server:

```bash
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run checks:

```bash
npm.cmd run lint
npm.cmd run check:secrets
npm.cmd audit --audit-level=high
npm.cmd run build
```

PowerShell may block `npm` because of script execution policy. Use `npm.cmd` on Windows.

## Documentation

- `docs/00_ProjectVision.md`
- `docs/01_BusinessRules.md`
- `docs/02_SystemArchitecture.md`
- `docs/03_DomainModel.md`
- `docs/04_DatabaseDesign.md`
- `docs/08_SecurityDesign.md`
- `docs/10_TestPlan.md`
- `docs/11_Changelog.md`
- `docs/12_DecisionLog.md`
- `docs/99_PendingOwnerReview.md`

## Security Baseline

- Do not commit `.env` files.
- Do not commit Firebase service accounts.
- Do not put server secrets in frontend code.
- Firestore and Storage rules must enforce authorization.
- Customer-facing data and internal operations data should be separated.

## GitHub

Repository: `https://github.com/astera-blip/Astera-OMS`
