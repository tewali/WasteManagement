# Working conventions

## Git

Push work **directly to the repository's default branch** — currently
`claude/waste-management-interface-4ellba` (the repo has no branch named
`main`; the default branch is what "main" refers to here). No feature branch
and no pull request unless explicitly asked for.

Note that `render.yaml` has `autoDeploy: true`, so a push to the connected
branch redeploys the app.

## Checks before pushing

```bash
npm test        # rules engine vs the R1-R4 fixture verdicts
npm run typecheck
```
