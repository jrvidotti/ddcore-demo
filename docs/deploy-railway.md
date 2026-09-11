# Deploying ddcore-demo on Railway

This guide covers a production deploy of the `demo` app on [Railway](https://railway.com/),
using a Docker container and PostgreSQL.

---

## 1. Prerequisites

1. A [Railway](https://railway.com/) account.
2. The `jrvidotti/ddcore-demo` repository on GitHub.
3. A published release of `jrvidotti/ddcore` at the version pinned in
   [.ddcore-version](../.ddcore-version) — that is where the build downloads the binary, desk
   included. The `Makefile` reads the same file, so development and deploy run the same
   version; to move up, edit the file and commit. Nothing changes in Railway's variables.

---

## 2. Deploy, step by step

### Step 1: create the project

1. In Railway's dashboard, click **+ New Project**.
2. Choose **Deploy from GitHub repo** and select `jrvidotti/ddcore-demo`.
3. Railway picks up [railway.json](../railway.json) and the [Dockerfile](../Dockerfile) on its
   own.

### Step 2: provision PostgreSQL

1. On the project canvas, click **+ New** and choose **Database → Add PostgreSQL**.
2. Railway creates a managed instance and exposes `DATABASE_URL` in the project.
3. On the `demo` service, go to **Variables** and add `DATABASE_URL` with the value
   `${{Postgres.DATABASE_URL}}`.

### Step 3: the required variables

Under **Variables** on the `demo` service:

| Variable | Example | Why |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | The provisioned database. ddcore connects and applies migrations through it. |
| `DDCORE_URL` | `https://demo-production.up.railway.app` | **Required.** The public HTTPS address. ddcore does **not** discover domains; without this, password-recovery and invitation links point at the wrong host. |
| `DDCORE_TRUST_PROXY` | `true` | **Required.** Tells ddcore it sits behind a TLS reverse proxy (Railway's Envoy/Cloudflare). Without it, secure cookies and login rate-limiting do not behave correctly. |

> [!IMPORTANT]
> Railway injects `PORT` per replica and ddcore honours it natively. Do not set it by hand.

---

## 3. Optional variables and secrets

### Mail (SMTP)

If the app is to send recovery links, invitations or notifications:

```env
DDCORE_MAIL_TRANSPORT=smtp
DDCORE_MAIL_FROM="Demo <no-reply@example.com>"
DDCORE_SMTP_HOST=smtp.sendgrid.net
DDCORE_SMTP_PORT=587
DDCORE_SMTP_USERNAME=apikey
DDCORE_SMTP_PASSWORD=your-key-here
DDCORE_SMTP_TLS=starttls
```

### Structured logs

Railway aggregates each replica's `stdout`. With `DDCORE_LOG_FORMAT=json` every line becomes an
indexable object carrying the `requestId` that also comes back in the `X-Request-Id` header and
is written to the `request_id` column of `Error Log` — that is what ties a user's complaint to
the log line and the error behind it.

```env
DDCORE_LOG_FORMAT=json
```

### Integration secrets

Secrets read with `ddcore.secret("name")` are injected with the `DDCORE_SECRET_` prefix — for
example `DDCORE_SECRET_STRIPE_KEY=sk_live_...`. The prefix is the boundary: an app reads its own
secrets and nothing else the process was started with.

---

## 4. Boot, healthcheck and migrations

- **Healthcheck.** Railway watches `/api/ready` (also `/readyz`), which pings the database under
  a deadline and answers `200 OK` only when the process can actually work — `503` when it
  cannot. That is what keeps traffic away before it is time.
  `/api/health` (or `/healthz`) is *liveness* only: `200` whenever the process is up, without
  touching the database. Use it to decide a restart, never routing — restarting the app because
  Postgres went down does not bring Postgres back. Neither route needs credentials.
- **Automatic migrations.** The container runs `ddcore start --auto-migrate`. At boot, before
  the HTTP port opens, ddcore applies transactionally:
  1. the framework's internal structure;
  2. `beforeSchema` patches;
  3. DDL for new DocTypes and columns;
  4. `afterSchema` patches and fixtures;
  5. the `afterMigrate` hook.

---

## 5. The first administrator

After the first successful deploy:

1. In Railway's dashboard, open the `demo` service and the **Deployments** tab.
2. Open the active deployment and its **Terminal / Exec** tab.
3. Create the first administrator:
   ```bash
   ddcore user add admin@example.com "Administrator" --password "StrongPassword123!" --role "System Manager"
   ```
4. Open the app's public URL and sign in.

---

## 6. Diagnostics

From the deployment's **Terminal / Exec**, `ddcore doctor` prints a full report — version,
database (with the DSN redacted), apps and DocTypes, pending DDL and patches, the queue,
`Error Log`, scheduler and workers. It works with the database down, which is exactly when the
command matters.

```bash
ddcore doctor              # readable report
ddcore doctor --json       # the same, for a collector
ddcore doctor --strict     # exits non-zero on warnings too, for CI
```

The same picture in numbers, over HTTP, is at `GET /api/health/report` and requires the
**System Manager** role.
