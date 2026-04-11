# Super Amber release flow

## Environments

- Production
  - Worktree: `/srv/classsitdown`
  - Service: `classsitdown-7741.service`
  - Port: `7741`
  - Public URL: `https://superamber.jiujianian.dev`

- Staging
  - Worktree: `/srv/classsitdown-staging`
  - Service: `classsitdown-staging-7781.service`
  - Port: `7781`
  - Public URL: `https://superamber-test.jiujianian.dev`
  - Report scripts: `~/.remotelab/instances/trial23/scripts`
  - Local health: `http://127.0.0.1:7781/api/health`

## Default Rule

Do not make unverified product changes directly in the production worktree.

## Canonical Seating Source

- Main site seating source now lives inside this repo at `frontend/src/vendor/superamber/`.
- Do not edit a separate sibling `superamber` repo for main-site seating behavior.
- Production runtime worktree remains `/srv/classsitdown`; if a second copy exists elsewhere, treat it as non-canonical unless it is explicitly symlinked here.

Primary test environment:

- URL: `https://superamber-test.jiujianian.dev`
- Purpose: verify every user-facing change before production release
- Rule: treat staging as the only place for first deployment and acceptance

For changes that can affect real users:

1. Apply and test the change in the staging worktree.
2. Run automated checks in staging:
   - Backend: `cd backend && npm test`
   - Frontend: `cd frontend && npm run build`
3. Restart only the staging service.
4. Verify the affected flow with real sample files or browser checks at `https://superamber-test.jiujianian.dev`.
5. Promote the same change to production only after staging passes.
6. Build production, restart production, and verify production health at `https://superamber.jiujianian.dev/api/health`.

Useful commands:

- Deploy current working copy to staging: `./scripts/deploy-staging.sh`
- Restart staging only: `./scripts/restart-staging.sh`
- Restart production only: `systemctl restart classsitdown-7741.service`

## Release Gate

Before every production update, confirm all items below:

- Staging build passes.
- Backend tests pass.
- `/api/health` is normal in staging after restart.
- The changed feature is manually exercised in staging.
- If the change touches class daily report, run the regression checklist below.

## Class Daily Report Regression

Use a real student workbook when touching the class daily report flow. At minimum verify:

- A wrong incoming `className` does not override the class code inferred from the student workbook filename.
- Standard report with no check-in file has no `打卡` leftovers in any worksheet.
- Standard report keeps the `待完成` column when no check-in file is uploaded.
- Detail report with no check-in file has no `打卡` leftovers.
- `/api/health` returns `{"status":"ok"}` after restart.
