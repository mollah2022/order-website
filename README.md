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

## Configuration

Admin access uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in `.env`.
The backend creates the configured admin account on startup if it does not
already exist. Database and admin credentials belong in the local `.env` file
or another private environment-variable store, never in source control.

# order-website
