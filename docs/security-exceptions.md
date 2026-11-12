# Security exceptions

Each entry corresponds to a line in `.trivyignore` or a filtered finding in CI. An entry has an
owner and an expiry date; when the date passes, the exception is removed and the gate either passes
on its own or blocks the build.

| CVE / advisory | Package | Why it is acceptable | Owner | Review by |
| --- | --- | --- | --- | --- |
| _none yet_ | | | | |

## How to add one

1. Confirm the vulnerable code path is actually reachable. If it is not, say so explicitly.
2. Add the id to `.trivyignore` (or narrow the audit with an override in `package.json`).
3. Add the row above with the reason, the owner, and a review date no more than 90 days out.
4. Mention it in the pull request that introduces it.
