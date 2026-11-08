---
name: deploy
description: Ship the current worktree branch to this fork's main.
---

# Deploy

Deploying means landing the current branch on `main` of the fork (`origin`, MartinBernstorff/t3code) and updating the root checkout. Never target `upstream` (pingdotgg/t3code).

## 1. Run checks

1. Commit any outstanding work
2. Run `vp run check:changed`. Fix failures and rerun until it passes. If a failure is unrelated to the branch, stop and report it instead of fixing it.

## 2. Create a PR and merge it

1. Push: `git push -u origin HEAD`
2. Open the PR against the fork
3. Merge it

## 3. Pull in the root checkout

1. Find the root checkout. It is the first entry of `git worktree list` (the main working tree)
2. Check its state with `git -C <root> status -sb`
3. Pull
4. Report the merged PR URL and the root checkout's new `HEAD`.
