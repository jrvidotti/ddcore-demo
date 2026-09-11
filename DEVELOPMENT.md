# Development: the ddcore-demo app

This document explains **how work is done** in this repository: what ddcore is, where the
boundary between the framework and an app runs, which files exist for what, and what the
day-to-day loop looks like.

Unlike the framework's own monorepo, there is nothing special about this checkout. It is an
ordinary app repository: the `ddcore` binary is **installed**, not compiled, and the SDKs
arrive as generated files under `.ddcore/`. There is one loop here, the app's, and it is the
same loop a product app has.

Alongside:

- `README.md` — what the app demonstrates and where each piece lives.
- `AGENTS.md` / `CLAUDE.md` — the short, non-negotiable rules.
- `docs/deploy-railway.md` — deploying this app as a container.
- `ddcore docs`, or the MCP resources `ddcore://docs/*` — **the canonical API reference**:
  `conventions`, `fieldtypes`, `controller-api`, `form-api`, `report-api`, `i18n`,
  `migrations`, `cli`. This document describes the mental model; it does not replace the API.

---

## 1. What ddcore is

ddcore is a **host**, not a library. A single Go binary carries the runtime, the HTTP API, the
whole desk UI, the scheduler and the tooling. An app is a directory of TypeScript that the host
reads and runs.

The consequences are the point:

- **The app has no build.** No bundler, no output directory. The host compiles the TypeScript
  it finds, keyed by filename suffix.
- **The app has no server of its own.** It does not open a port, route a request or manage a
  transaction. It says what is true about the domain; the host decides when to ask.
- **The app has no production `node_modules`.** The one dev dependency here is `typescript`,
  used by `tsc --noEmit` and by nothing at run time.
- **Server-side code is synchronous.** It runs in goja, which has no event loop. There is no
  `await`, no `Promise`, no `setTimeout`. A database call returns a value.

### The three SDKs

| Import | Where it runs | What it gives you |
|---|---|---|
| `@ddcore/sdk` | the server, **synchronous** | `defineDoctype`, `defineController`, `defineReport`, `defineWorkspace`, `extendDoctype`, `whitelisted`, `_`, and the global `ddcore` (`db`, `getDoc`, `newDoc`, `utils`, `throw`, `log`, `enqueue`) |
| `@ddcore/sdk/test` | `ddcore test` | `describe` / `it` / `expect` |
| `@ddcore/desk-sdk` | the browser, **asynchronous** | `defineForm`, `defineListView`, `ddcore.ui.Dialog`, `ddcore.db.*` (over HTTP), `ddcore.format`, `ddcore.datetime` |

All three are **materialised** by `ddcore types` into `.ddcore/sdk/` and `.ddcore/desk-sdk/`,
and `tsconfig.json`'s `paths` point there. That is why typechecking never needs a checkout of
the framework: the binary carries the sources and writes them out on demand. The same command
writes `.ddcore/types.d.ts`, the interfaces generated from this app's DocTypes, and
`.ddcore/desk.entry.ts`, the desk entry point built from `desk.include`.

`.ddcore/` is gitignored and must **never** be edited by hand.

---

## 2. Division of responsibilities

### What ddcore does

- **The meta-model** — a DocType declaration becomes a `tab_<doctype>` table and its DDL
  migrations; field types, options, `reqd`, `unique`, links, child tables.
- **The document lifecycle** — `validate`, `beforeInsert`, `afterInsert`, `onUpdate`,
  `onTrash`, submit/cancel, versioning under `trackChanges`.
- **Transactions** — one per request and one per test, rolled back on error.
- **Permissions** — by role, by DocType, by document, plus the API's authentication.
- **The HTTP API** — `/api/resource/*` for documents, `/api/method/<app>.<path>.<fn>` for
  whitelisted functions, `/api/boot` for the desk.
- **The whole desk UI** — lists, forms, workspaces, reports, the grid, filters, search.
- **Scheduler and queues** — `daily`, `cron`, `ddcore.enqueue`.
- **The tooling** — `dev`, `migrate`, `test`, `types`, `i18n`, `exec`, `eval`, `demo`, `jobs`,
  `user`, `apikey`, `doctor`, `docs`, `mcp`.

### What this app does

- **Declares the domain**: the `Project`, `Task`, `Invoice` and `Project Settings` DocTypes
  with their child tables, and the `Project Manager` and `Project Contributor` roles.
- **Writes the rules** in controllers and services: date-range validation, the idempotent
  `start` / `complete` / `reopen` transitions, recalculating a project's progress, marking
  overdue tasks daily, splitting an invoice into instalments that add back up.
- **Declares navigation and reading**: the `Projects` workspace (sidebar, shortcuts, number
  cards, chart) and the `Tasks by Status` report.
- **Adjusts the UI at the edges**: `*.form.ts` for buttons, indicators and a Link's filter —
  and `client/lists.ts` shows the opposite, that with `optionColors` on the status field a list
  needs no custom indicator at all.
- **Extends a DocType it does not own**: `extensions/user.extend.ts` adds `default_project` to
  the core's `User` without forking it.
- **Declares the periodic routine** in `ddcore.app.ts` (`daily: demo.services.tasks.markOverdue`)
  — the host is what runs it.
- **Seeds a demonstration** in `services/demo.ts`, idempotent, discovered by `ddcore demo`.
- **Covers all of it** with `*.test.ts`.

Being an example, it **deliberately avoids** things the framework supports: external
integrations, attachments, `hasPermission` / `permissionQuery`, raw SQL, and patches with no
real migration to demonstrate. Do not push it to grow — a worked case earns its place only by
being the one someone will copy.

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

---

## 3. Anatomy of the repository

```
ddcore.app.ts                 the manifest: name, roles, scheduler, desk
ddcore.json                   what the site decided: apps, currency, timezone, access policy
.env / .env.example           where it is running: database, port, public URL, mail
.ddcore-version               the ddcore release this app is written against
install-ddcore.sh             downloads that release into .ddcore/bin
Makefile                      shortcuts for the working loop
doctypes/<name>/
  <name>.doctype.ts           meta: fields, permissions, naming         [server, declarative]
  <name>.controller.ts        lifecycle hooks and methods               [server, synchronous]
  <name>.form.ts              the form's behaviour in the desk          [browser, async]
  <name>.test.ts              tests                                     [ddcore test]
services/*.ts                 reusable business rules                   [server, synchronous]
client/*.ts                   global desk scripts                       [browser, async]
reports/*.report.ts           reports                                   [server, synchronous]
workspaces/*.workspace.ts     navigation and dashboard                  [server, declarative]
extensions/*.extend.ts        fields and property setters on a DocType owned by another app
translations/<lang>.csv       translations
.ddcore/                      GENERATED by `ddcore types` — do not edit
docker-compose.yml            development Postgres on port 5457
Dockerfile / railway.json     container deploy
```

**Filename suffixes are the discovery mechanism.** There is no index file and nothing to
register: `.doctype.ts`, `.controller.ts`, `.form.ts`, `.report.ts`, `.workspace.ts`,
`.extend.ts` and `.test.ts` each mean something to the host, and a file is picked up by being
named correctly and placed in the right directory.

Configuration is split by the question it answers. `ddcore.json` holds what the site decided —
its apps, currency and precision, timezone, access policy — so it is committed and identical on
a laptop and in production. `.env` holds where the site is running — the database, the port,
the public URL, outgoing mail, and the secrets an integration needs — so it is gitignored, and
`.env.example` is the committed record of which variables exist. Precedence runs outwards: the
real environment beats `.env`, which beats `ddcore.json`. That order is what lets Railway inject
`DATABASE_URL` without anyone editing a file inside the image.

### A DocType's four files

Take `Task`:

**`task.doctype.ts` — the meta.** Fields, types, labels, permissions, how the document is
named. Declarative: no logic. `status` is `readOnly` with `optionColors`, because the desk
colours and translates a Select from the declaration alone, and because nothing outside the
controller may write it.

**`task.controller.ts` — the rules.** Lifecycle hooks (`validate`, `afterInsert`, `onUpdate`,
`onTrash`) and the document's methods (`start`, `complete`, `reopen`). The methods are
idempotent: completing a completed task returns the current state instead of failing. Hooks
call into `services/` rather than carrying logic themselves.

**`task.form.ts` — the desk.** Runs in the browser, may be asynchronous. It shows the buttons
the current state allows and calls `frm.call("complete")` — it never writes a derived field,
because the invariant lives on the server.

**`task.test.ts` — the tests.** `import "@ddcore/sdk/test"` brings in `describe` / `it` /
`expect`. Each `it` runs inside a transaction that is rolled back afterwards, so tests need no
cleanup and cannot leak into one another.

### Services: where the domain actually lives

A good controller is thin. The logic goes in `services/*.ts`, because it has to be callable
from several places with the same meaning: from `validate`, from a controller method, from a
report, from a workspace card, from the scheduler, from `ddcore exec` and from the tests. This
app shows it four times:

- `services/projects.ts:recalculateProgress` — called after inserting, updating or deleting a
  task, and writing the derived columns with `dbSet` so no hook re-enters;
- `services/tasks.ts:markOverdue` — called by the daily scheduler **and**, through the
  `markOverdueNow` wrapper (`whitelisted`, restricted to `Project Manager`), by a desk button;
- `services/tasks.ts:summaryByStatus` — shared by the report **and** by the workspace chart, so
  the two counts cannot drift apart;
- `services/billing.ts:schedule` — fills an invoice's instalments so the parts add back up to
  the whole, placing the rounding residue deliberately rather than letting three thirds of
  100.00 come out a cent short.

Functions marked `whitelisted(...)` get an HTTP endpoint
(`POST /api/method/demo.services.tasks.markOverdueNow`) — that is how the desk calls the server
outside a document's context. Note the namespace: it is the `name` declared in `ddcore.app.ts`,
not the directory this repository happens to be cloned into.

Interface text is written as an English key and translated in `translations/<lang>.csv`.
`ddcore i18n extract` rewrites the catalogue from the code, and a key with no translation is an
error rather than a screen that silently falls back to English.

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

`make dev` keeps running. The host watches the app's files and reloads the definitions in
memory, so **editing a doctype, a controller, a service or a translation does not need a
restart**. What does need one is a new `ddcore` binary.

After changing meta — a field, a DocType, a permission — run `make migrate` for the DDL and
`make types` for the regenerated `.ddcore/types.d.ts`. Write the test first; `make test` is the
definition of done.

### The commands that matter

| Command | What it does |
|---|---|
| `make dev` | server with hot reload on `:8092` |
| `make migrate` | DDL migrations and patches |
| `make types` | regenerates `.ddcore/` (types and SDKs) |
| `make check` | `types` + `tsc --noEmit` |
| `make test` | `check` + every `*.test.ts` in rolled-back transactions |
| `make demo` | seeds demonstration data (idempotent) |
| `make stop` | stops whatever is listening on `:8092` |
| `.ddcore/bin/ddcore exec demo.services.tasks.markOverdue` | runs a service outside a request |
| `.ddcore/bin/ddcore test --filter <regex>` | narrows the test run while iterating |
| `.ddcore/bin/ddcore docs` | the API reference |
| `.ddcore/bin/ddcore doctor` | diagnoses configuration and connectivity |

`DDCORE=../ddcore/bin/ddcore make test` runs the whole thing against a framework build that has
not been released yet — the way to find out whether a change to ddcore breaks this app before
the tag exists.

### Non-negotiable rules

- The server is **synchronous**: no `await` / `Promise` in `*.controller.ts`, `services/`,
  `reports/`, `workspaces/`, `patches/`.
- The desk (`*.form.ts`, `client/*.ts`) **may** be asynchronous — and almost always is.
- **Never** edit `.ddcore/`; run `make types`.
- An invariant is validated on the server (`validate`), never only in the form.
- Interface text is English, goes through `_()` / `__()` or a `label:`, and has a row in the
  translation CSV.
- Nothing imports source by a relative path outside this repository: the SDKs come in only as
  `@ddcore/sdk` and `@ddcore/desk-sdk`.
- No raw SQL; queries go through `ddcore.db.getList` and friends.
- `make test` before calling anything done.

---

## 5. Reading one flow end to end

"Complete a task" crosses every layer and serves as a map:

1. **Desk** — `doctypes/task/task.form.ts` shows the `Complete` button according to the state
   and calls `frm.call("complete")`.
2. **Host** — receives `POST /api/resource/Task/:name/complete`, authenticates, checks
   permission, opens the transaction, loads the document and invokes the controller's method in
   goja.
3. **Controller** — `task.controller.ts:methods.complete` is idempotent: if it is already
   completed it returns the current state; otherwise it sets `status = "Completed"`,
   `completed_at = ddcore.utils.now()` and saves through the normal lifecycle.
4. **Hook + service** — Task's `onUpdate` calls `services/projects.ts:recalculateProgress`,
   which counts completed tasks and writes the Project's `progress` and `status` with `dbSet`,
   so no hook re-enters.
5. **Host** — on success, commit and `{ status, completed_at }` in the response; on
   `ddcore.throw`, rollback and a business message on screen, translated at the border into the
   reader's language.
6. **Desk** — reloads the document; the indicator and the progress come back updated, and the
   workspace's card and chart show the same count because they read the same service.

The same path is exercised with no UI at all by `doctypes/task/task.test.ts`. That is the shape
of the framework: **the host moves the document through the lifecycle and the transaction; the
app says what is true about the domain at each point along the way.**
