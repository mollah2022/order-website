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

## Development

For the Vite development server and backend reload mode, run:

```sh
docker compose up --build
```

The frontend is available at `http://localhost:5173/`, and the API is available
at `http://localhost:8000/`.

## Configuration

The backend requires `SECRET_KEY` and `ADMIN_PASSWORD` at startup. Database
credentials and admin credentials belong in the local `.env` file or another
private environment-variable store, never in source control.
# order-website
