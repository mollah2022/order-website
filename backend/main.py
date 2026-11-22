import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError
from pydantic import BaseModel, Field

DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("POSTGRES_DB")
DB_USER = os.getenv("POSTGRES_USER")
DB_PASS = os.getenv("POSTGRES_PASSWORD")
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

app = FastAPI(title="Order API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/admin/login")

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def get_conn():
    connection_options = {
        "host": DB_HOST,
        "dbname": DB_NAME,
        "user": DB_USER,
        "password": DB_PASS,
        "cursor_factory": RealDictCursor,
    }
    return psycopg2.connect(**connection_options)

@app.on_event("startup")
def create_admin():
    if not SECRET_KEY or not ADMIN_PASSWORD:
        raise RuntimeError("SECRET_KEY and ADMIN_PASSWORD environment variables are required")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """CREATE TABLE IF NOT EXISTS delivery_areas (
               id SERIAL PRIMARY KEY,
               name VARCHAR(100) UNIQUE NOT NULL,
               fee NUMERIC(10, 2) NOT NULL CHECK (fee >= 0),
               is_active BOOLEAN NOT NULL DEFAULT TRUE
           )"""
    )
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS area_name VARCHAR(100)")
    cur.execute("SELECT COUNT(*) AS count FROM delivery_areas")
    if cur.fetchone()["count"] == 0:
        settings = get_settings(cur)
        cur.executemany(
            "INSERT INTO delivery_areas (name, fee) VALUES (%s, %s)",
            [
                ("Inside Dhaka", settings.get("delivery_dhaka", 60)),
                ("Outside Dhaka", settings.get("delivery_outside", 120)),
            ],
        )
    cur.execute(
        """UPDATE orders SET area_name = CASE area
               WHEN 'dhaka' THEN 'Inside Dhaka'
               WHEN 'outside' THEN 'Outside Dhaka'
               ELSE area
           END
           WHERE area_name IS NULL"""
    )
    cur.execute("SELECT id FROM admins WHERE username=%s", (ADMIN_USERNAME,))
    if not cur.fetchone():
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            "INSERT INTO admins (username, password_hash) VALUES (%s,%s)",
            (ADMIN_USERNAME, hashed),
        )
    conn.commit()
    conn.close()


def get_settings(cur):
    cur.execute("SELECT key, value FROM settings")
    return {r["key"]: float(r["value"]) for r in cur.fetchall()}


def current_admin(token: str = Depends(oauth2)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Public API ----------

@app.get("/api/products")
def list_products():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products WHERE is_active=TRUE ORDER BY id")
    rows = cur.fetchall()
    conn.close()
    return rows


@app.get("/api/delivery-charges")
def delivery_charges():
    conn = get_conn()
    cur = conn.cursor()
    s = get_settings(cur)
    conn.close()
    return {"dhaka": s["delivery_dhaka"], "outside": s["delivery_outside"]}


@app.get("/api/delivery-areas")
def delivery_areas():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, fee FROM delivery_areas WHERE is_active=TRUE ORDER BY id"
    )
    areas = cur.fetchall()
    conn.close()
    return areas


class Item(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=100)


class OrderIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=150)
    phone: str = Field(min_length=11, max_length=14)
    address: str = Field(min_length=5)
    area: str  # "dhaka" or "outside"
    note: Optional[str] = None
    items: List[Item] = Field(min_length=1)


@app.post("/api/orders")
def create_order(order: OrderIn):
    try:
        area_id = int(order.area)
    except ValueError:
        raise HTTPException(400, "Invalid delivery area")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT name, fee FROM delivery_areas WHERE id=%s AND is_active=TRUE",
            (area_id,),
        )
        area = cur.fetchone()
        if not area:
            raise HTTPException(400, "Selected delivery area is unavailable")
        delivery = float(area["fee"])
        subtotal = 0
        lines = []
        for it in order.items:
            cur.execute(
                """UPDATE products SET stock = stock - %s
                   WHERE id=%s AND is_active=TRUE AND stock >= %s
                   RETURNING id, name, price""",
                (it.quantity, it.product_id, it.quantity),
            )
            p = cur.fetchone()
            if not p:
                cur.execute("SELECT name, stock FROM products WHERE id=%s", (it.product_id,))
                info = cur.fetchone()
                if info:
                    raise HTTPException(
                        400, f"Sorry, only {info['stock']} left for {info['name']}"
                    )
                raise HTTPException(400, f"Product {it.product_id} not found")
            subtotal += float(p["price"]) * it.quantity
            lines.append((p, it.quantity))
        total = subtotal + delivery
        cur.execute(
            """INSERT INTO orders (customer_name, phone, address, area, area_name,
               note, subtotal, delivery_charge, total)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (order.customer_name, order.phone, order.address, str(area_id),
             area["name"], order.note, subtotal, delivery, total),
        )
        order_id = cur.fetchone()["id"]
        for p, qty in lines:
            cur.execute(
                """INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                   VALUES (%s,%s,%s,%s,%s)""",
                (order_id, p["id"], p["name"], p["price"], qty),
            )
        conn.commit()
        return {"order_id": order_id, "subtotal": subtotal,
                "delivery_charge": delivery, "total": total}

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# ---------- Admin API ----------

@app.post("/api/admin/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM admins WHERE username=%s", (form.username,))
    admin = cur.fetchone()
    conn.close()
    if not admin or not bcrypt.checkpw(form.password.encode(), admin["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Wrong username or password")
    token = jwt.encode(
        {"sub": admin["username"], "exp": datetime.utcnow() + timedelta(hours=12)},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/admin/orders")
def admin_orders(status: Optional[str] = None, admin: str = Depends(current_admin)):
    conn = get_conn()
    cur = conn.cursor()
    if status:
        cur.execute("SELECT * FROM orders WHERE status=%s ORDER BY id DESC", (status,))
    else:
        cur.execute("SELECT * FROM orders ORDER BY id DESC")
    orders = cur.fetchall()
    for o in orders:
        cur.execute("SELECT * FROM order_items WHERE order_id=%s", (o["id"],))
        o["items"] = cur.fetchall()
    conn.close()
    return orders


@app.get("/api/admin/delivery-charges")
def admin_delivery_charges(admin: str = Depends(current_admin)):
    conn = get_conn()
    cur = conn.cursor()
    settings = get_settings(cur)
    conn.close()
    return {
        "dhaka": settings["delivery_dhaka"],
        "outside": settings["delivery_outside"],
    }


@app.get("/api/admin/delivery-areas")
def admin_delivery_areas(admin: str = Depends(current_admin)):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, fee, is_active FROM delivery_areas ORDER BY id")
    areas = cur.fetchall()
    conn.close()
    return areas


class DeliveryAreaIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    fee: float = Field(ge=0)


@app.post("/api/admin/delivery-areas")
def add_delivery_area(area: DeliveryAreaIn, admin: str = Depends(current_admin)):
    name = area.name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Area name must contain at least 2 non-space characters")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            """INSERT INTO delivery_areas (name, fee) VALUES (%s, %s)
               RETURNING id, name, fee, is_active""",
            (name, area.fee),
        )
        result = cur.fetchone()
        conn.commit()
        return result
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(409, "A delivery area with this name already exists")
    finally:
        conn.close()


@app.put("/api/admin/delivery-areas/{area_id}")
def update_delivery_area(
    area_id: int,
    area: DeliveryAreaIn,
    admin: str = Depends(current_admin),
):
    name = area.name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Area name must contain at least 2 non-space characters")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            """UPDATE delivery_areas SET name=%s, fee=%s
               WHERE id=%s RETURNING id, name, fee, is_active""",
            (name, area.fee, area_id),
        )
        result = cur.fetchone()
        if not result:
            raise HTTPException(404, "Delivery area not found")
        conn.commit()
        return result
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(409, "A delivery area with this name already exists")
    finally:
        conn.close()


@app.patch("/api/admin/delivery-areas/{area_id}/active")
def set_delivery_area_active(
    area_id: int,
    active: bool,
    admin: str = Depends(current_admin),
):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT is_active FROM delivery_areas WHERE id=%s FOR UPDATE", (area_id,))
        area = cur.fetchone()
        if not area:
            raise HTTPException(404, "Delivery area not found")
        if area["is_active"] and not active:
            cur.execute("SELECT COUNT(*) AS count FROM delivery_areas WHERE is_active=TRUE")
            if cur.fetchone()["count"] <= 1:
                raise HTTPException(400, "At least one delivery area must remain active")
        cur.execute(
            "UPDATE delivery_areas SET is_active=%s WHERE id=%s RETURNING id, name, fee, is_active",
            (active, area_id),
        )
        result = cur.fetchone()
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class DeliveryChargesIn(BaseModel):
    dhaka: float = Field(ge=0)
    outside: float = Field(ge=0)


@app.put("/api/admin/delivery-charges")
def update_delivery_charges(
    charges: DeliveryChargesIn,
    admin: str = Depends(current_admin),
):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.executemany(
            """INSERT INTO settings (key, value) VALUES (%s, %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            [
                ("delivery_dhaka", str(charges.dhaka)),
                ("delivery_outside", str(charges.outside)),
            ],
        )
        conn.commit()
        return {"dhaka": charges.dhaka, "outside": charges.outside}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class StatusIn(BaseModel):
    status: str


@app.patch("/api/admin/orders/{order_id}")
def update_status(order_id: int, body: StatusIn, admin: str = Depends(current_admin)):
    if body.status not in ("pending", "confirmed", "shipped", "delivered", "cancelled"):
        raise HTTPException(400, "Invalid status")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT status FROM orders WHERE id=%s", (order_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Order not found")
    old = row["status"]
    new = body.status
    if old != "cancelled" and new == "cancelled":
        cur.execute(
            """UPDATE products p SET stock = p.stock + oi.quantity
               FROM order_items oi
               WHERE oi.order_id=%s AND oi.product_id = p.id""",
            (order_id,),
        )
    elif old == "cancelled" and new != "cancelled":
        cur.execute(
            """UPDATE products p SET stock = GREATEST(p.stock - oi.quantity, 0)
               FROM order_items oi
               WHERE oi.order_id=%s AND oi.product_id = p.id""",
            (order_id,),
        )
    cur.execute("UPDATE orders SET status=%s WHERE id=%s", (new, order_id))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/admin/products/upload")
async def upload_product_image(
    file: UploadFile = File(...),
    admin: str = Depends(current_admin),
):
    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Only JPG, PNG, WEBP, or GIF images are allowed")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image must be 5 MB or smaller")
    filename = f"{uuid.uuid4().hex}{allowed[file.content_type]}"
    path = UPLOAD_DIR / filename
    path.write_bytes(content)
    return {"url": f"/uploads/{filename}"}


class ProductIn(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    stock: int = 100
    is_active: bool = True


@app.get("/api/admin/products")
def admin_products(admin: str = Depends(current_admin)):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products ORDER BY id")
    rows = cur.fetchall()
    conn.close()
    return rows


@app.post("/api/admin/products")
def add_product(p: ProductIn, admin: str = Depends(current_admin)):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO products (name, description, price, image_url, stock, is_active)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
        (p.name, p.description, p.price, p.image_url, p.stock, p.is_active),
    )
    pid = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return {"id": pid}


@app.put("/api/admin/products/{pid}")
def edit_product(pid: int, p: ProductIn, admin: str = Depends(current_admin)):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """UPDATE products SET name=%s, description=%s, price=%s,
           image_url=%s, stock=%s, is_active=%s WHERE id=%s""",
        (p.name, p.description, p.price, p.image_url, p.stock, p.is_active, pid),
    )
    conn.commit()
    conn.close()
    return {"ok": True}
