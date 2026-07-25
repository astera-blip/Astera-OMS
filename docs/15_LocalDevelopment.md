# Local Development Guide

This guide is for owner/developer setup on Windows.

## Installed by Codex

- Node.js `v24.18.0`
- npm `11.16.0`
- Eclipse Temurin JDK 21 for Firebase Emulator
- Project dependencies from `package-lock.json`

## Common Commands

Use `npm.cmd` in PowerShell on Windows.

```bash
npm.cmd run dev
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run firebase:rules:test
npm.cmd run check:secrets
npm.cmd audit --audit-level=high
npm.cmd run build
```

## Local URLs

- Next.js app: `http://localhost:3000`
- Firebase Emulator UI: `http://localhost:4000` after running `npm.cmd run firebase:emulators`

## Why `npm.cmd`

PowerShell may block `npm.ps1` because script execution is disabled. `npm.cmd` avoids changing system policy.

## What Not To Commit

- `.env.local`
- real Firebase project IDs if they are not meant for the repository
- service account JSON
- bank exports
- customer lists
- shipping exports
- private videos or attachments

Run `npm.cmd run check:secrets` before committing.
