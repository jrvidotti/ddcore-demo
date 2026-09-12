# Development: the ddcore-demo app

This document explains **how work is done in this repository**: where the boundary between the
framework and an app runs, which files exist for what, and what the day-to-day loop looks like.

It does not document the framework's API. That lives in `ddcore docs` (or the MCP resources
`ddcore://docs/*`), it ships inside the pinned binary, and it is the authority — run
`.ddcore/bin/ddcore docs` for the list that version actually carries, starting with `conventions`.
Anything below that looks like API reference is a pointer, on purpose.

Unlike the framework's own monorepo, there is nothing special about this checkout. It is an
ordinary app repository: the `ddcore` binary is **installed**, not compiled, and the SDKs arrive as
generated files under `.ddcore/`. There is one loop here, the app's, and it is the same loop a
product app has.

Alongside:

- `README.md` — what the app demonstrates and where each piece lives.
- `AGENTS.md` / `CLAUDE.md` — the short, non-negotiable rules.
- `docs/deploy-railway.md` — deploying this app as a container.

---

## 1. Where the boundary runs

ddcore is a **host**, not a library. A single Go binary carries the runtime, the HTTP API, the whole
desk UI, the scheduler and the tooling; an app is a directory of TypeScript the host reads and runs.
Three consequences shape this repository: the app has **no build** and no output directory, it has
**no production `node_modules`** (the one dev dependency is `typescript`, for `tsc --noEmit`), and
its server code is **synchronous** — goja has no event loop, so there is no `await` and a database
call returns a value.

The three SDKs — `@ddcore/sdk` (server, synchronous), `@ddcore/sdk/test` and `@ddcore/desk-sdk`
(browser, asynchronous) — are **materialised** by `ddcore types` into `.ddcore/`, where
`tsconfig.json`'s `paths` point. That is why typechecking never needs a checkout of the framework:
the binary carries the sources and writes them out on demand, along with `.ddcore/types.d.ts` and
`.ddcore/desk.entry.ts`. `.ddcore/` is gitignored and must **never** be edited by hand.

Everything else — the meta-model and its DDL, the document lifecycle, transactions, permissions, the
HTTP API, the desk, the scheduler and the queue, the CLI — is the host's, and `ddcore docs` is the
list of it.

### The boundary, one line per case

| You need… | Who resolves it |
|---|---|
| a table, a column, an index | the host, from the DocType declaration |
| an invariant of the domain | the app, in `validate` on the server |
| a state transition | the app, in a controller method |
| a rule used from several places | the app, in `services/*.ts` |
| a screen, a list, a filter, a grid | the host |
| a button or an indicator on a form | the app, in `*.form.ts` |
| an HTTP endpoint | the host, from `whitelisted(...)` |
| authentication, permission, transaction | the host |
| a daily routine | declared by the app, run by the host |
| a data migration | the app, in `patches/NNNN_*.ts` |
| something the host does not do at all | neither — upstream, see below |

The third answer exists because an app cannot compile anything into the host: a capability ddcore
lacks cannot be added from here, only worked around. When the workaround is standing in for
framework code — and another app would need the same thing — write the workaround so the app keeps
shipping, then draft a feature request at https://github.com/jrvidotti/ddcore/issues, search the
open and closed issues first, and **ask before opening it**. The criteria and the issue skeleton are
in the framework's `feature-requests` document, served by `ddcore docs` once the pinned release
carries it. After such a change lands, `DDCORE=../ddcore/bin/ddcore make test` checks it against
this app before the release is tagged.

### What this app does

- **Declares the domain**: the `Project`, `Task`, `Invoice` and `Project Settings` DocTypes with
  their child tables, and the `Project Manager` and `Project Contributor` roles.
- **Writes the rules** in controllers and services: date-range validation, the idempotent
  `start` / `complete` / `reopen` transitions, recalculating a project's progress, marking overdue
  tasks daily, splitting an invoice into instalments that add back up.
- **Declares navigation and reading**: the `Projects` workspace (sidebar, shortcuts, number cards,
  chart) and the `Tasks by Status` report.
- **Adjusts the UI at the edges**: `*.form.ts` for buttons, indicators and a Link's filter — and
  `client/lists.ts` shows the opposite, that with `optionColors` on the status field a list needs no
  custom indicator at all.
- **Extends a DocType it does not own**: `extensions/user.extend.ts` adds `default_project` to the
  core's `User` without forking it.
- **Declares the periodic routine** in `ddcore.app.ts` (`daily: demo.services.tasks.markOverdue`) —
  the host is what runs it.
- **Seeds a demonstration** in `services/demo.ts`, idempotent, discovered by `ddcore demo`.
- **Covers all of it** with `*.test.ts`.

Being an example, it **deliberately avoids** things the framework supports: external integrations,
attachments, `hasPermission` / `permissionQuery`, raw SQL, and patches with no real migration to
demonstrate. Do not push it to grow — a worked case earns its place only by being the one someone
will copy.

---

## 2. The repository

An app's layout — which directory holds what, and which filename suffix means which definition — is
`conventions`. There is no index file and nothing to register: a file is picked up by being named
correctly and placed in the right directory.

What is particular to *this* repository, being an app that stands on its own:

```
.ddcore-version               the ddcore release this app is written against
install-ddcore.sh             downloads that release into .ddcore/bin
Makefile                      the working loop, and the DDCORE override
ddcore.json                   what the site decided: apps, currency, timezone, access policy
.env / .env.example           where it is running: database, port, public URL, mail
docker-compose.yml            development Postgres on port 5457
Dockerfile / railway.json     container deploy
```

Configuration is split by the question it answers. `ddcore.json` holds what the site decided — its
apps, currency and precision, timezone, access policy — so it is committed and identical on a laptop
and in production. `.env` holds where the site is running — the database, the port, the public URL,
outgoing mail, and the secrets an integration needs — so it is gitignored, and `.env.example` is the
committed record of which variables exist. Precedence runs outwards: the real environment beats
`.env`, which beats `ddcore.json`. That order is what lets Railway inject `DATABASE_URL` without
anyone editing a file inside the image.

---

## 3. Reading this app

**A DocType's four files.** Take `Task`: `task.doctype.ts` is meta and carries no logic (`status` is
`readOnly` with `optionColors`, so the desk colours and translates it from the declaration alone);
`task.controller.ts` holds the lifecycle hooks and the idempotent methods `start` / `complete` /
`reopen`, calling into `services/` rather than carrying logic itself; `task.form.ts` runs in the
browser and only shows what the state allows, calling `frm.call("complete")` because the invariant
lives on the server; `task.test.ts` runs each `it` in a transaction that is rolled back afterwards.
See `controller-api` and `form-api`.

**Services are where the domain actually lives.** A good controller is thin, because the logic has
to be callable from several places with the same meaning: from `validate`, from a controller method,
from a report, from a workspace card, from the scheduler, from `ddcore exec` and from the tests.
This app shows it four times:

- `services/projects.ts:recalculateProgress` — called after inserting, updating or deleting a task,
  and writing the derived columns with `dbSet` so no hook re-enters;
- `services/tasks.ts:markOverdue` — called by the daily scheduler **and**, through the
  `markOverdueNow` wrapper (`whitelisted`, restricted to `Project Manager`), by a desk button;
- `services/tasks.ts:summaryByStatus` — shared by the report **and** by the workspace chart, so the
  two counts cannot drift apart;
- `services/billing.ts:schedule` — fills an invoice's instalments so the parts add back up to the
  whole, placing the rounding residue deliberately rather than letting three thirds of 100.00 come
  out a cent short.

A `whitelisted(...)` function gets an HTTP endpoint
(`POST /api/method/demo.services.tasks.markOverdueNow`) — that is how the desk calls the server
outside a document's context. Note the namespace: it is the `name` declared in `ddcore.app.ts`, not
the directory this repository happens to be cloned into.

---

## 4. The development loop

### Setup (once)

```bash
make install-ddcore                          # .ddcore/bin/ddcore, pinned by .ddcore-version
make docker-up                               # dev Postgres (container ddcore-demo-pg, port 5457)
make migrate                                 # the core's DDL + installing this app
.ddcore/bin/ddcore user passwd Administrator admin1234
make demo                                    # demonstration data (idempotent)
make dev                                     # http://localhost:8092
```

### The loop

`make dev` keeps running. The host watches the app's files and reloads the definitions in memory, so
**editing a doctype, a controller, a service or a translation does not need a restart**. What does
need one is a new `ddcore` binary.

After changing meta — a field, a DocType, a permission — run `make migrate` for the DDL and
`make types` for the regenerated `.ddcore/types.d.ts`. Write the test first; `make test` is the
definition of done, and the rules it is not allowed to break are in `AGENTS.md` and in
`conventions`.

| Target | What it does |
|---|---|
| `make dev` | server with hot reload on `:8092` |
| `make migrate` | DDL migrations and patches |
| `make types` | regenerates `.ddcore/` (types and SDKs) |
| `make check` | `types` + `tsc --noEmit` + the translation catalogue |
| `make test` | `check` + every `*.test.ts` in rolled-back transactions |
| `make demo` | seeds demonstration data (idempotent) |
| `make stop` | stops whatever is listening on `:8092` |
| `make ddcore-version` | the pinned release, and the binary actually in use |

The binary's own commands — `exec`, `eval`, `test --filter`, `jobs`, `user`, `doctor`, `docs` — are
in `cli`. Two are worth knowing here: `make help` lists the targets above, and
`DDCORE=../ddcore/bin/ddcore make test` runs the whole thing against a framework build that has not
been released yet, which is how to find out whether a change to ddcore breaks this app before the
tag exists.

---

## 5. Reading one flow end to end

"Complete a task" crosses every layer and serves as a map:

1. **Desk** — `doctypes/task/task.form.ts` shows the `Complete` button according to the state and
   calls `frm.call("complete")`.
2. **Host** — receives `POST /api/resource/Task/:name/complete`, authenticates, checks permission,
   opens the transaction, loads the document and invokes the controller's method in goja.
3. **Controller** — `task.controller.ts:methods.complete` is idempotent: if it is already completed
   it returns the current state; otherwise it sets `status = "Completed"`,
   `completed_at = ddcore.utils.now()` and saves through the normal lifecycle.
4. **Hook + service** — Task's `onUpdate` calls `services/projects.ts:recalculateProgress`, which
   counts completed tasks and writes the Project's `progress` and `status` with `dbSet`, so no hook
   re-enters.
5. **Host** — on success, commit and `{ status, completed_at }` in the response; on `ddcore.throw`,
   rollback and a business message on screen, translated at the border into the reader's language.
6. **Desk** — reloads the document; the indicator and the progress come back updated, and the
   workspace's card and chart show the same count because they read the same service.

The same path is exercised with no UI at all by `doctypes/task/task.test.ts`. That is the shape of
the framework: **the host moves the document through the lifecycle and the transaction; the app says
what is true about the domain at each point along the way.**
