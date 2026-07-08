---
name: Drizzle sql() aggregates
description: How to type GROUP BY aggregates (count, sum, array_agg) in Drizzle ORM queries
---

## Rule
Use `sql<ReturnType>\`pg_expression::pg_type\`` for aggregate columns in Drizzle `.select()`.

Examples:
```ts
count: sql<number>`count(*)::int`
totalQty: sql<number>`sum(quantity)::int`
ids: sql<number[]>`array_agg(id order by id)`
statuses: sql<string[]>`array_agg(status order by id)`
uniqueCount: sql<number>`count(distinct card_number) filter (where card_number is not null)::int`
```

**Why:** Drizzle ORM doesn't have first-class typed aggregate helpers. Using `sql<T>` with explicit PG casts (`::int`, `::text[]`) ensures the inferred TS type matches the actual runtime value.

**How to apply:** In `.having()` clauses, plain `sql\`count(*) > 1\`` works without a type param since it's a boolean condition. For `.orderBy()` in GROUP BY queries, use `sql\`count(*) desc, name asc\`` rather than column references.
