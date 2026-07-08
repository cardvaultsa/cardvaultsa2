---
name: Zod in api-server
description: Zod must be explicitly listed as a dependency in api-server/package.json; it is not inherited from the workspace root.
---

## Rule
Any route in `artifacts/api-server` that imports from `"zod/v4"` requires `zod` in the **api-server** `package.json` `dependencies`, not just root dev deps.

**Why:** pnpm hoisting doesn't guarantee a sub-package can resolve a root-only dev dep at runtime (the CJS bundle uses `require` and the dep must be resolved at bundle time).

**How to apply:**
```bash
pnpm --filter @workspace/api-server add zod
# Uses catalog entry — installs ^3.25.76
```
Import as: `import { z } from "zod/v4";`
