
require("dotenv").config();
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("railway") ? { rejectUnauthorized: false } : undefined
});

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const seedProducts = [
  {
    id: "oil-filter",
    name: "Filtru ulei Premium",
    category: "Filtre",
    price: 74.90,
    image: "/images/oil-filter.jpg",
    description: "Filtru de ulei pentru motoare pe benzină și diesel.",
    badge: "Popular",
    stock: 18
  },
  {
    id: "air-filter",
    name: "Filtru aer Premium",
    category: "Filtre",
    price: 99.90,
    image: "/images/air-filter.jpg",
    description: "Filtrare eficientă și protecție îmbunătățită pentru motor.",
    badge: "Nou",
    stock: 14
  },
  {
    id: "brake-pads",
    name: "Plăcuțe frână set față",
    category: "Frâne",
    price: 249.90,
    image: "/images/brake-pads.jpg",
    description: "Set plăcuțe față pentru frânare sigură și confortabilă.",
    badge: "Best seller",
    stock: 9
  },
  {
    id: "spark-plugs",
    name: "Bujii set 4 buc.",
    category: "Motor",
    price: 164.90,
    image: "/images/spark-plugs.jpg",
    description: "Set de 4 bujii pentru aprindere stabilă și pornire sigură.",
    badge: "",
    stock: 22
  },
  {
    id: "battery",
    name: "Baterie auto 74Ah",
    category: "Electrică",
    price: 549.90,
    image: "/images/battery.jpg",
    description: "Baterie 12V pentru autoturisme și utilizare zilnică.",
    badge: "",
    stock: 7
  },
  {
    id: "led-kit",
    name: "Kit LED H7",
    category: "Iluminare",
    price: 299.90,
    image: "/images/led-kit.jpg",
    description: "Iluminare LED albă, design modern și montaj rapid.",
    badge: "Popular",
    stock: 11
  }
];

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL CHECK(price >= 0),
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      badge TEXT DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      email TEXT,
      phone TEXT,
      amount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ron',
      status TEXT NOT NULL DEFAULT 'pending',
      stripe_session_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0)
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM products");
  if (rows[0].count === 0) {
    for (const p of seedProducts) {
      await pool.query(
        `INSERT INTO products(id,name,category,price,image,description,badge,stock)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.id,p.name,p.category,p.price,p.image,p.description,p.badge,p.stock]
      );
    }
  }
}

// Stripe webhook must receive the raw body before express.json().
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send("Stripe webhook is not configured.");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = Number(session.metadata?.orderId);
    if (orderId) {
      await pool.query(
        `UPDATE orders
         SET status='paid',
             stripe_session_id=$1,
             email=COALESCE($2,email),
             amount_total=$3
         WHERE id=$4`,
        [
          session.id,
          session.customer_details?.email || null,
          (session.amount_total || 0) / 100,
          orderId
        ]
      );
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id,name,category,price::float,image,description,badge,stock
     FROM products WHERE active=TRUE ORDER BY created_at ASC`
  );
  res.json(rows);
});

app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe nu este configurat încă." });
  }

  const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
  const phone = String(req.body.phone || "").trim().slice(0, 40);
  if (!cart.length) return res.status(400).json({ error: "Coșul este gol." });

  const ids = [...new Set(cart.map(x => String(x.id)))];
  const { rows: products } = await pool.query(
    `SELECT id,name,price::float,stock FROM products WHERE active=TRUE AND id = ANY($1::text[])`,
    [ids]
  );
  const map = new Map(products.map(p => [p.id, p]));

  const normalized = [];
  for (const item of cart) {
    const p = map.get(String(item.id));
    const qty = Math.max(1, Math.min(20, Number(item.qty) || 1));
    if (!p) return res.status(400).json({ error: "Un produs nu mai este disponibil." });
    if (p.stock < qty) return res.status(400).json({ error: `Stoc insuficient pentru ${p.name}.` });
    normalized.push({ ...p, qty });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const total = normalized.reduce((sum, x) => sum + x.price * x.qty, 0);
    const orderResult = await client.query(
      `INSERT INTO orders(phone,amount_total,currency,status)
       VALUES($1,$2,'ron','pending') RETURNING id`,
      [phone || null, total.toFixed(2)]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of normalized) {
      await client.query(
        `INSERT INTO order_items(order_id,product_id,name,unit_price,quantity)
         VALUES($1,$2,$3,$4,$5)`,
        [orderId, item.id, item.name, item.price, item.qty]
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: normalized.map(item => ({
        quantity: item.qty,
        price_data: {
          currency: "ron",
          unit_amount: Math.round(item.price * 100),
          product_data: { name: item.name }
        }
      })),
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      customer_creation: "always",
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?checkout=cancelled`,
      metadata: { orderId: String(orderId) }
    });

    await client.query(
      "UPDATE orders SET stripe_session_id=$1 WHERE id=$2",
      [session.id, orderId]
    );
    await client.query("COMMIT");
    res.json({ url: session.url });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Nu am putut iniția plata." });
  } finally {
    client.release();
  }
});

app.get("/api/order-status", async (req, res) => {
  const sessionId = String(req.query.session_id || "");
  if (!sessionId) return res.status(400).json({ error: "Lipsește session_id." });

  const { rows } = await pool.query(
    `SELECT id,status,amount_total::float,currency,created_at
     FROM orders WHERE stripe_session_id=$1`,
    [sessionId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Comanda nu a fost găsită." });
  res.json(rows[0]);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`AutoForge running on port ${PORT}`)))
  .catch(err => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });
