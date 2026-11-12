# Postgres with Drizzle ORM

Postgres 17 is the only datastore; Drizzle is the only way application code touches it.

A store's hard problems are transactional — stock decrements, order placement, uniqueness of an
order number — and Postgres solves them in the database with row locks and constraints. Drizzle
keeps the schema in TypeScript next to the queries that use it, generates reviewable SQL
migrations, and adds no runtime engine, which matters on a single small VPS. Document metadata
(variant attributes, addresses, settings) uses JSONB, so the customizable parts do not force a
schema migration.

## Consequences

- Migrations are generated with `drizzle-kit` and committed as SQL; a schema change ships with its
  migration in the same pull request.
- Raw SQL is allowed inside a service when it expresses a lock or a constraint more clearly than the
  builder. It is not allowed in a page or an action.
- Any ORM that hides generated SQL behind an opaque API is out, because the migrations would become
  unreviewable.
