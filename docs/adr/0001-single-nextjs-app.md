# One Next.js app, not a separate API

The storefront, admin, and API live in one Next.js application rather than a web/API split.

A split adds CORS and cross-origin token handling, a second dependency tree, and a second thing to
patch — security work that buys nothing for a single operator, while a split's real benefit (an
independent API for other clients) is not needed yet. One app also removes the class of bug where
the admin and storefront disagree about who the user is.

Domain rules live in `src/server/services`, which take a database handle and know nothing about
HTTP. That module boundary is the seam: if a mobile client or external API ever justifies a split,
services are lifted behind HTTP without rewriting the rules.

## Considered options

- **Turborepo with a separate API service**: rejected for now — real cost, deferred benefit.
- **Serverless functions per endpoint**: rejected — the VPS runs containers, and the store needs a
  long-lived database connection pool.
