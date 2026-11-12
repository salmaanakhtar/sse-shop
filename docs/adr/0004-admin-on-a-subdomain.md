# Admin on a subdomain, served by the same app

The admin lives at `admin.<domain>` in the same deployment as the storefront, not at `/admin` on the
store's domain and not as a separate service.

A distinct hostname lets the admin be gated outside the application — Caddy basic auth today,
Tailscale later — without touching storefront traffic or cookie scope. Cookies set on the admin
host are not sent to the storefront host, so an admin session is not exposed to storefront pages or
to any script they load. Because it is the same process, there is one deployment, one dependency
tree, and one set of authorization helpers.

Middleware rewrites the admin host to the `/admin` route tree. Middleware is routing only: every
admin page, action, and route handler re-checks the session and role itself, because middleware has
been the bypassed layer in real framework CVEs.

## Consequences

- The production domain and DNS control are prerequisites for launch.
- Local development simulates this with a host header rewrite; end-to-end tests drive the admin on
  its rewritten path.
