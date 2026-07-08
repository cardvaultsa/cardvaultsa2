---
name: OpenAPI batch edits
description: Use a Python script for multi-point YAML edits; sequential edit-tool calls on the same file are slow and risky.
---

## Rule
When making 5+ targeted changes to `lib/api-spec/openapi.yaml`, write a single Python script that does all `str.replace()` calls at once, then write the result back. Run codegen immediately after.

**Why:** The YAML file is large (~2000+ lines). Sequential `edit` tool calls to the same file are slow and each call risks mismatching context after a prior edit shifts line numbers. A Python script is atomic, fast, and easy to verify by printing the output line count.

**How to apply:** Use `python3 << 'PYEOF' ... PYEOF` inline bash heredoc. Verify each replacement succeeded (check for unique anchor strings before replacing). Print final line count as a sanity check.
