# Release Workflow (Strict)

This repository now uses a strict branch and release model:

- `main` = production source of truth
- `staging` = pre-production validation
- feature branches = all active development

## Branch Flow

1. Create feature branch from `staging`:
   - `codex/<feature-name>`
2. Open PR into `staging`.
3. Required CI checks pass on `staging`.
4. `staging` deploys automatically to Vercel preview.
5. Open PR from `staging` into `main`.
6. Policy check enforces that PR into `main` must come from `staging`.
7. Merge into `main`.
8. Production release workflow runs:
   - verify tests + build
   - create `prod-YYYYMMDD-<run_number>` tag (or reuse existing tag on rerun)
   - deploy production to Vercel

## GitHub Actions Added

- `.github/workflows/ci-required-checks.yml`
  - Runs tests and build on PR/push for `staging` and `main`
  - Required check job name: `portal-tests-build`

- `.github/workflows/deploy-staging.yml`
  - Trigger: push to `staging` or manual dispatch
  - Runs verify + deploy preview on Vercel

- `.github/workflows/release-branch-policy.yml`
  - Trigger: PRs into `main`
  - Fails if PR source branch is not `staging`

- `.github/workflows/release-production.yml`
  - Trigger: push to `main` or manual dispatch
  - Runs verify + production tagging + Vercel production deploy

## Required Repository Secrets

Set these in GitHub repo settings (`Settings` -> `Secrets and variables` -> `Actions`):

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Required Branch Protection Settings

### Protect `staging`

- Require a pull request before merging
- Require status checks to pass before merging
  - Required check: `portal-tests-build`
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Restrict who can push directly (recommended: no direct pushes except release admins)

### Protect `main`

- Require a pull request before merging
- Require status checks to pass before merging
  - Required checks:
    - `portal-tests-build`
    - `enforce-main-from-staging`
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Include administrators in restrictions
- Restrict who can push directly (recommended: no direct pushes)

## One-Time Setup Commands

Create `staging` branch from current `main` if it does not exist:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

## Release Tag Convention

Each production deploy creates or reuses a tag:

- `prod-YYYYMMDD-<run_number>`

Example:

- `prod-20260226-412`

This gives an immutable production marker for rollback and audit.
