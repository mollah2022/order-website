# Order Website

A product ordering website with a React frontend, FastAPI backend, and PostgreSQL database.

## Run with Docker Compose

1. Copy `.env.example` to `.env`.
2. Replace every placeholder in `.env` with private, strong values. Do not commit `.env`.
3. Start the production services:

   ```sh
   docker compose -f docker-compose.prod.yml up -d --build
   ```

The shop is available at `http://localhost/`, and the admin dashboard is at
`http://localhost/admin`.

The admin dashboard lets you manage orders, products, stock, and delivery areas.
You can add areas, change their names and fees, and disable or re-enable them.
Active areas appear in checkout, and their configured fees are included in new
order totals.

The storefront and admin dashboard follow the device color theme by default.
Use the theme toggle to switch modes; the selected preference is saved in the
browser and shared between both pages.

Order creation times are stored with timezone information and displayed in
Bangladesh time (Asia/Dhaka) in the admin dashboard.

Product image files are uploaded to Cloudinary; product records and image URLs
are stored in PostgreSQL. Configure `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `.env`. Existing images
previously stored in the local Docker upload volume can be migrated from the
Admin Products page after Cloudinary is configured.

Product stock does not block or change when a customer places an order. Stock is
deducted when an admin confirms the order; moving it back to pending or
cancelling it restores the deducted stock.

## Development

For the Vite development server and backend reload mode, run:

```sh
docker compose up --build
```

The frontend is available at `http://localhost:5173/`, and the API is available
at `http://localhost:8000/`.

## Host on Vercel, Render, and Neon

1. Create a PostgreSQL project on Neon. In the Neon SQL Editor, run the contents
   of [`db/init.sql`](./db/init.sql) once to create the tables and initial
   sample products. Copy the pooled connection string from Neon; it must include
   `sslmode=require`.
2. Deploy this repository to Render using the included [`render.yaml`](./render.yaml)
   Blueprint. When prompted, set `DATABASE_URL` to the Neon connection string,
   choose a private `ADMIN_USERNAME` and strong `ADMIN_PASSWORD`, and set
   `FRONTEND_ORIGINS` to the Vercel site's exact origin, such as
   `https://your-project.vercel.app` (no trailing slash). Set the Cloudinary
   values if Admin image uploads are needed.
3. Wait for the Render service to become healthy, then copy its public URL,
   for example `https://gramer-bazar-api.onrender.com`.
4. Import the same repository into Vercel and set the project Root Directory to
   `frontend`. Add the environment variable `VITE_API_URL` with the Render
   service URL (no trailing slash), then deploy. Vercel builds the frontend
   with `npm run build` and serves the `dist` output.
5. If Vercel assigns a different production domain, add that exact origin to
   Render's `FRONTEND_ORIGINS` and redeploy/restart the backend.

The Render Blueprint keeps secrets out of the repository. The frontend API
address is public configuration, but database credentials, admin credentials,
the JWT secret, and Cloudinary API secret must only be entered in provider
environment settings. Render's free web service may sleep when idle, so the
first request after inactivity can take longer.

## Configuration

Admin access uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in `.env`.
The backend creates the configured admin account on startup if it does not
already exist. Database and admin credentials belong in the local `.env` file
or another private environment-variable store, never in source control.

# order-website
