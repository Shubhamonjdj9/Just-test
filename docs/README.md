# Atelier full-stack store

A MERN storefront built with React, Vite, Express, and MongoDB. The API owns prices, stock reservations, coupon usage, order state, and payment verification; the browser never supplies a trusted checkout total.

## Local setup

Requirements: Node.js 20 or newer, npm, and a MongoDB instance.

From the repository root:

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` locally. Keep real credentials out of source control and chat. `JWT_SECRET` should be a fresh random value of at least 32 characters. The sample MongoDB URL uses a local database named `atelier_store`; change `MONGODB_URI` if that is not the database you intend to use.

This checkout's PowerShell `npm` shim is misconfigured. If `npm install` does not work, run the equivalent command with the installed Node CLI:

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' install
```

Use the same `node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run <script>` form for the npm scripts below on this machine. A standard Node.js installation can use `npm` normally. Development servers bind to loopback; production binds the API to all interfaces for deployment behind a configured HTTPS reverse proxy.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | Use `development` locally; production requires a strong `JWT_SECRET`. |
| `PORT` | No | API port (default `4000`). |
| `CLIENT_URL` | No | Exact browser origin permitted by API CORS (default `http://localhost:5173`). |
| `MONGODB_URI` | Yes | Local MongoDB URI for development or a remotely reachable MongoDB URI (normally Atlas) for Docker/Netlify. |
| `JWT_SECRET` | Recommended locally; required in production | Signs the HttpOnly authentication cookie. Login sessions expire after 2 days. When omitted in development, a temporary random key is generated on each API start. |
| `COOKIE_SECURE` | Optional | `true` sets Secure/SameSite=None session cookies; unset defaults to `true` in production and `false` in development. Docker's local HTTP setup defaults to `false`; set it to `true` behind HTTPS. |
| `MONGO_ROOT_USERNAME` | Docker Compose only | MongoDB root user created on the first initialization of its persistent volume. |
| `MONGO_ROOT_PASSWORD` | Docker Compose only | Required MongoDB root password. Use a strong URL-safe value; it is used by the API's internal MongoDB connection. |
| `RAZORPAY_KEY_ID` | For payments | Razorpay **test-mode** key ID. |
| `RAZORPAY_KEY_SECRET` | For payments | Matching Razorpay **test-mode** secret; used server-side only. |
| `RAZORPAY_WEBHOOK_SECRET` | For webhook confirmation | Secret configured for the Razorpay webhook endpoint. |
| `CLOUDINARY_CLOUD_NAME` | Optional | Enables server-signed product image uploads when all three Cloudinary values are set. |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret; never expose it to the browser. |
| `SMTP_HOST` | Optional | SMTP host for password-reset email. |
| `SMTP_PORT` | Optional | SMTP port (default `587`). |
| `SMTP_USER` | Optional | SMTP username. |
| `SMTP_PASSWORD` | Optional | SMTP password. |
| `EMAIL_FROM` | Optional | Sender address for transactional mail. |
| `ADMIN_EMAIL` | Only for one-time admin creation | New administrator email address. |
| `ADMIN_PASSWORD` | Only for one-time admin creation | New administrator password (12+ characters, with uppercase, lowercase, and a number). |

Start both development processes:

```powershell
npm run dev
```

Open <http://localhost:5173>. The API is at <http://localhost:4000/api/v1>; its health endpoint is `/health`. Vite proxies `/api` requests to the API.

If the seeded demo catalog is wanted, first confirm `MONGODB_URI` points to the intended development database, then run:

```powershell
npm run seed
```

Seeding is repeatable and inserts sample records only when their slugs do not already exist; it does not replace existing products or stock. To create the first administrator, add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the local `.env` and run:

```powershell
npm run create:admin
```

This command refuses to promote an existing customer or replace an existing administrator. Remove the two admin-only values from `.env` after creation. Sign in at `/login`; administrators are routed to `/admin`.

For this workspace's local development database, the seed command has already inserted four categories and eight sample products so the storefront can be explored. No administrator or payment credentials were created.

## Run the full application with Docker

Install and start Docker Desktop (with the Compose plugin), then create a local environment file without replacing one that already exists:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Generate two separate random values, for `JWT_SECRET` and `MONGO_ROOT_PASSWORD`, and put them in `.env`. The Mongo password should be URL-safe (a hexadecimal value from the command below works):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Docker Compose requires both values before it starts. It builds the React client into an Nginx image, builds the Express API as a non-root Node container, and starts MongoDB 8 with authentication and a named persistent data volume. Only the web container is published to the host, bound to localhost at <http://localhost:8080>; Nginx serves the client and proxies `/api/` requests to the API. MongoDB and the API are not exposed as host ports. Compose health checks gate API and client startup on MongoDB/API readiness.

```powershell
docker compose up --build -d
docker compose ps
```

The named MongoDB volume retains the database across container recreation and `docker compose down`. Seed the Docker database only if you want the demo products in that separate database:

```powershell
docker compose exec api node src/seed.js
```

To create an administrator for Docker, temporarily set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored `.env`, then run:

```powershell
docker compose exec api node src/create-admin.js
```

Clear those two values after account creation and recreate the API container so the credentials are no longer in its environment:

```powershell
docker compose up -d --force-recreate api
```

The Compose stack uses local HTTP, so it sets `COOKIE_SECURE=false` by default to allow sign-in cookies on localhost. For deployment, put the web service behind an HTTPS reverse proxy that forwards the original host/protocol, change `CLIENT_URL` in `docker-compose.yml` to the exact public HTTPS origin, set `COOKIE_SECURE=true` in `.env`, and configure the web port for that proxy. The default port binding is loopback-only; do not expose it directly to the internet. Keep the MongoDB volume and API private; back up the volume and secrets independently. Nginx refreshes the Docker API service address through Docker's internal DNS when that container is recreated. The Razorpay webhook can be routed through the web service at `/api/v1/payments/webhook`, but a reachable HTTPS public endpoint is required for provider delivery.

Stop the containers while preserving MongoDB data with:

```powershell
docker compose down
```

Do not use `docker compose down --volumes` unless you intentionally want to permanently delete the Docker MongoDB data.

## Checks

```powershell
npm test
npm run build
docker compose config
```

The backend tests run with Node's built-in test runner. `npm run build` creates the production client in `client/dist`. `docker compose config` validates the resolved Compose configuration (after required secrets are set). For the API alone, use `npm run server`; for the storefront alone, use `npm run client`.

## Deploy the full app to Netlify

The root [`netlify.toml`](../netlify.toml) builds the client, publishes `client/dist`, deploys the Express API as a Netlify Function, rewrites `/api/v1/*` to that function, and keeps the existing client-side routes working. The scheduled function also releases expired unpaid-order inventory once per minute on published production deploys.

### Choose and configure MongoDB

This application uses Mongoose and MongoDB models. Netlify Database is PostgreSQL, and Netlify Blobs is a key-value store; neither can be used as the existing MongoDB database without rewriting the persistence layer. Use MongoDB Atlas, or another MongoDB server with secure public connectivity.

For Atlas, create a database and a dedicated database user with access only to this app's database. In Atlas Network Access, allow connections from Netlify Functions. Netlify's normal function egress does not provide a single fixed IP to allow-list on standard plans, so Atlas may require `0.0.0.0/0`; protect this with a strong database-user password, least-privilege access, and an encoded `mongodb+srv://` connection URI. Never commit this URI or paste it into chat. A MongoDB service running only on your computer or bound to `localhost` is not reachable from Netlify.

### Connect and deploy

1. Push this project to a Git provider and import the repository into Netlify. Set the Netlify base directory to the repository root (the default); `netlify.toml` contains the build, publish, function, and redirect settings.
2. In Netlify site environment variables, set these **runtime** values for the Functions scope:
   - `NODE_ENV=production`
   - `JWT_SECRET` to a new random secret of at least 32 characters (do not reuse a development or Docker secret)
   - `MONGODB_URI` to the Atlas connection URI for the app's database
   - `CLIENT_URL` to the exact deployed site origin, for example `https://your-site-name.netlify.app` (no trailing slash). Use your custom-domain origin instead if that is the URL customers will use.
   - `COOKIE_SECURE=true`
3. Add any optional Razorpay **test-mode**, SMTP, and Cloudinary variables listed above to Netlify runtime environment variables if you need those integrations. Do not set `ADMIN_EMAIL` or `ADMIN_PASSWORD` as persistent deploy variables.
4. Trigger a deploy and check `https://your-site-name.netlify.app/api/v1/health`; it should return `{"data":{"status":"ok"}}`. The storefront and API then share the Netlify origin, so browser API calls stay same-origin.
5. To add sample products, run the idempotent seed script once using the **same Atlas URI** in a trusted local environment: set `MONGODB_URI` locally to the Atlas database URI and run `npm run seed`. Review the URI and target database first; seed inserts the four sample categories and eight products only when their slugs are absent.
6. To create an administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` only in a trusted local environment with that same Atlas URI, run `npm run create:admin`, then remove both variables. Netlify deploys cannot see your workstation's `.env`; never add admin setup credentials as site variables.

Deploy Previews use a different origin from the production URL. Since browser mutation protection requires an exact `CLIENT_URL` match, account-changing requests and sign-in will be blocked in previews unless the server configuration is intentionally extended to allow the preview origin. Verify the production site URL and `CLIENT_URL` match exactly before testing sign-in.

Netlify Functions are not a general-purpose always-on Node server. The existing API is adapted for request/response Functions and caches its MongoDB connection per warm function instance. The payment reservation cleanup runs through a scheduled Function; schedules run on published deploys, not automatically on Deploy Previews. Configure Atlas network access and Netlify runtime variables before testing catalog, login, checkout, or admin routes.

Netlify's internal function rewrite has a 26-second proxy timeout. Keep MongoDB reachable and requests bounded; long-running reports or bulk operations should not be put on synchronous API routes.

## Payments and external services

Without Razorpay credentials, payment order creation and provider verification are unavailable; do not treat a browser redirect as payment confirmation. Configure test keys and the webhook secret from the Razorpay dashboard before testing. Point the Razorpay webhook to:

```text
https://<public-api-host>/api/v1/payments/webhook
```

Use HTTPS and the exact webhook signing secret for the configured Razorpay endpoint. Enable the `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`, and `refund.failed` events. A local API needs a secure public tunnel for Razorpay to reach its webhook. Use only Razorpay's documented test payment methods while developing; no real payment credentials belong in this project.

Cloudinary uploads require all three Cloudinary environment variables. Without them, administrators can add an existing image URL instead. SMTP is optional, but password-reset email requires a working SMTP configuration; without it, reset emails cannot be delivered.

## Implemented

- Responsive React storefront with product browsing, text search, category/price/rating filters, sorting, pagination, product details, reviews, contact, and newsletter forms.
- Account registration/sign-in, password reset flow, address book, saved products, authenticated cart, checkout, order history, and order cancellation.
- Express/Mongoose API with request validation, centralized errors, secure password hashing, HttpOnly JWT cookies, role-protected administration, and request rate limits.
- Server-calculated INR checkout totals, coupon checks, stock reservation/release, order idempotency, and order-status history.
- Razorpay server order creation, server-side signature/provider checks, signed webhooks, and idempotency safeguards. Live provider behavior still requires Razorpay test credentials and a reachable webhook.
- Admin catalog and inventory management, order fulfillment/refund actions, customer and review moderation, category/coupon creation, messages, analytics, and optional Cloudinary uploads.
- Reduced-motion-aware interface and lazy-loaded page modules.

## Remaining work and verification limits

- Guest cart persistence and merging, and a dedicated buy-now flow.
- Editing/deleting categories and coupons, broader store settings, and downloadable report exports.
- Page-specific metadata and a generated sitemap.
- Comprehensive frontend and database-backed API integration tests, including an end-to-end payment test against Razorpay test mode.
- Production deployment configuration, hosting, HTTPS, backups, email delivery, Cloudinary uploads, and payment webhooks have not been exercised here.

The local MongoDB database is not seeded by default, and no administrator or external-service credentials are created by this project setup. Run the seed and admin commands only after checking the target database and your local `.env`.

The production dependency audit is clean after the SMTP dependency update. The full audit still reports advisories in the Tailwind 3 development dependency tree; review that toolchain before making a development server available outside the local machine.
