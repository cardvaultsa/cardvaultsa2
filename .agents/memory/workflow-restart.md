---
name: Workflow restart in this artifacts monorepo
description: How to restart workflows reliably here.
---

# Restarting workflows

Workflow names in this artifacts monorepo are prefixed with the artifact slug, e.g. `artifacts/api-server: API Server`, `artifacts/pokedex-vault: web`, `artifacts/mockup-sandbox: Component Preview Server`.

Always call `listWorkflows()` (code_execution) to get the EXACT current name, then restart with code_execution `restartWorkflow({ workflowName, timeout })`.

**Why:** restarting with a guessed/short name fails ("run command doesn't exist"). Use the exact full prefixed name from `listWorkflows()`.

The api-server dev workflow runs `build` then `start`, so a restart picks up source changes and newly-set env vars.
