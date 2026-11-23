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

Product stock does not block or change when a customer places an order. Stock is
deducted when an admin marks the order as delivered; cancelling or moving a
delivered order back to another status restores the deducted stock.

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

Checkout requires the customer's email address. When an admin changes an order
to `confirmed`, the backend emails the customer using the SMTP settings in `.env`.
For Gmail, set `SMTP_USERNAME` and `SMTP_FROM_EMAIL` to the sender's Gmail
address and `SMTP_PASSWORD` to a Google App Password (not the Gmail sign-in
password), then recreate the backend container. Confirmation is not saved if
the email cannot be sent.
# order-website
