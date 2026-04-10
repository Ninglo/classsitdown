# Super Amber release flow

## Environments

- Production
  - Worktree: `/Users/jiujianian/code/classsitdown`
  - Service: `com.jiujianian.classsitdown-7741`
  - Port: `7741`
  - Public URL: `https://superamber.jiujianian.dev`

- Staging
  - Worktree: `/Users/jiujianian/code/classsitdown-staging`
  - Service: `com.jiujianian.classsitdown-staging-7781`
  - Port: `7781`
  - Public URL: `https://superamber-test.jiujianian.dev`
  - Report scripts: `/Users/jiujianian/code/classsitdown-staging/report-scripts`

## Default Rule

Do not make unverified product changes directly in the production worktree.

For changes that can affect real users:

1. Apply and test the change in the staging worktree.
2. Run the frontend build in staging.
3. Restart only the staging service.
4. Verify the affected flow with real sample files or browser checks.
5. Promote the same change to production only after staging passes.
6. Build production, restart production, and verify production health.

## Class Daily Report Regression

Use a real student workbook when touching the class daily report flow. At minimum verify:

- A wrong incoming `className` does not override the class code inferred from the student workbook filename.
- Standard report with no check-in file has no `打卡` leftovers in any worksheet.
- Standard report keeps the `待完成` column when no check-in file is uploaded.
- Detail report with no check-in file has no `打卡` leftovers.
- `/api/health` returns `{"status":"ok"}` after restart.
