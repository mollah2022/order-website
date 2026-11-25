CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    image_url TEXT,
    stock INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    area VARCHAR(20) NOT NULL,
    area_name VARCHAR(100),
    note TEXT,
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_charge NUMERIC(10,2) NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'COD',
    status VARCHAR(20) DEFAULT 'pending',
    stock_deducted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL
);

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE settings (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(100) NOT NULL
);

CREATE TABLE delivery_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    fee NUMERIC(10, 2) NOT NULL CHECK (fee >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO settings (key, value) VALUES
    ('delivery_dhaka', '60'),
    ('delivery_outside', '120');

INSERT INTO products (name, description, price, stock) VALUES
    ('Sample Product 1', 'Eta test product', 500, 50),
    ('Sample Product 2', 'Eta o test product', 1200, 30);
