# Recipe Chat Bot Agent Guidance

These instructions apply to the entire repository. Keep feature specifications and product decisions in their dedicated plans or roadmap documents; this file defines the durable engineering workflow.

## Package management

- Use pnpm exclusively for JavaScript and TypeScript dependencies, package scripts, audits, and one-off package CLIs.
- Keep `package.json` and `pnpm-lock.yaml` synchronized and do not introduce another package-manager lockfile.
- Use `pnpm add`, `pnpm add --save-dev`, `pnpm remove`, `pnpm run`, `pnpm exec`, `pnpm dlx`, and `pnpm audit` as appropriate.
- Do not bypass peer-dependency or install-script safety warnings without documenting the compatibility or security tradeoff.

## Delivery loop

Work in bounded vertical slices that each produce a complete, verifiable behavior:

1. Inspect the relevant code and establish a clean baseline.
2. Implement the smallest complete slice that advances the requested outcome.
3. Run focused tests for the changed behavior.
4. Run the applicable repository-wide quality gates.
5. Review the diff for correctness, security issues, accidental edits, and exposed sensitive data.
6. Repair failures and repeat the loop until the slice is green.

Continue through local implementation and verification without routine checkpoints. Pause when work requires new credentials, a destructive action, a production mutation, a major scope or architecture decision, or user input that cannot be safely inferred.

## Quality gates

Before handing off completed implementation work, run:

- `pnpm run test`
- `pnpm run check`
- `pnpm run build`
- `pnpm run db:check` when database schema, queries, or migrations change
- `pnpm audit` when dependencies change

If a check cannot run, state exactly why and identify the unverified behavior. Do not report work as complete while a relevant failing check remains unexplained.

## Security and data handling

- Keep secrets in server-only environment variables. Never print, commit, return to clients, or copy secret values into documentation, fixtures, logs, or generated artifacts.
- Treat authentication, authorization, ownership checks, rate limits, data retention, and security headers as invariants unless the task explicitly changes them.
- Validate untrusted input at the server boundary and return sanitized errors without stack traces, provider payloads, credentials, or sensitive user data.
- Keep database migrations, schema definitions, application behavior, tests, and operational documentation synchronized.
- Preserve account deletion and cascading cleanup behavior when adding user-owned records.

## Git and external systems

- Preserve existing user changes and keep unrelated edits out of the task diff.
- Do not use destructive Git operations to clean or rewrite the worktree.
- Commit, push, deploy, change hosted secrets, or run production migrations only when the current task or active goal explicitly authorizes that action.
- Resolve and report the exact commit and deployment state when external delivery is part of the task.

## Completion evidence

End each completed loop with a concise record of:

- the behavior delivered;
- the validation commands and results;
- any residual risks or intentionally deferred work;
- commit and deployment status when applicable; and
- the next remaining vertical slice when the broader goal is still active.
