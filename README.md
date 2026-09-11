# ddcore-demo

The example app for [ddcore](https://github.com/jrvidotti/ddcore) — a small projects, tasks and
invoicing domain that reads as an executable tutorial. It is a standalone app repository: it
builds against the **published `ddcore` binary** and needs no checkout of the framework, which
is exactly the arrangement a product app uses.

## Development

Requirements: Docker and Node.js. The `ddcore` binary is downloaded by `make install-ddcore`
into `.ddcore/bin`, pinned to the version in `.ddcore-version`; it carries the runtime, the
desk and the SDK typings.

```bash
make install-ddcore
make docker-up
make migrate
.ddcore/bin/ddcore user passwd Administrator admin1234
make demo
make dev                 # http://localhost:8092
```

`DDCORE=/path/to/ddcore make test` runs against a specific binary — which is how you try this
app against an unreleased framework build. Use `ddcore docs`, or the MCP resources
`ddcore://docs/*`, for the API reference.

## What it demonstrates

Each piece is here because it shows one thing an app author has to do, and the file that
carries it is the place to read about it.

| Feature | Where |
|---|---|
| DocType with child table, naming by field, Select colours | `doctypes/project/`, `doctypes/task/` |
| Lifecycle hooks and idempotent document methods | `doctypes/task/task.controller.ts` |
| Derived fields written without hook recursion | `services/projects.ts` (`dbSet`) |
| Business rules shared by hook, report, chart and scheduler | `services/tasks.ts` |
| Currency precision and an instalment schedule that adds up | `doctypes/invoice/`, `services/billing.ts` |
| Single DocType (a settings singleton) | `doctypes/project_settings/` |
| Extending a core DocType from an app | `extensions/user.extend.ts` |
| Form scripts: buttons, indicators, a Link's filter | `doctypes/*/*.form.ts`, `extensions/user.form.ts` |
| List view without a custom indicator (`optionColors` suffices) | `client/lists.ts` |
| Workspace: sidebar, shortcuts, number cards, chart | `workspaces/projects.workspace.ts` |
| Report with filters, totals and a chart | `reports/tasks_by_status.report.ts` |
| A whitelisted HTTP method, restricted by role | `services/tasks.ts` (`markOverdueNow`) |
| Scheduler (daily) | `ddcore.app.ts` |
| Idempotent seed discovered by `ddcore demo` | `services/demo.ts` |
| Translation catalogue | `translations/pt-BR.csv` |

Every one of them is covered by a `*.test.ts` next to it; `make test` runs the lot inside
rolled-back transactions.

## The domain

A **Project** has milestones and tasks. A **Task** moves through Open → In progress →
Completed by controller methods only — nothing writes `status` directly — and a task past its
due date is marked Overdue by the daily routine. The Project's `progress` and `status` are
derived from its tasks and never typed by hand. An **Invoice** exists for one reason: to carry
a worked case of decimal precision, with a schedule of instalments that adds back up to the
total.

## Deploy

`Dockerfile` and `railway.json` deploy this app as a container that installs the pinned
`ddcore` release at build time. See [`docs/deploy-railway.md`](docs/deploy-railway.md).

## Notes

The development process — what the core does, what the app does, and the working loop — is in
[`DEVELOPMENT.md`](DEVELOPMENT.md).
