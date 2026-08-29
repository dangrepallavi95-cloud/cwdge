const express = require("express");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDirectory = path.join(__dirname, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, "cwdge.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Trial',
    card_status TEXT NOT NULL DEFAULT 'Active',
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Paid',
    paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(card_id) REFERENCES cards(id)
  );
`);

if (db.prepare("SELECT COUNT(*) AS count FROM customers").get().count === 0) {
  const seed = db.transaction(() => {
    db.prepare("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)").run("Asorkars Soap", "hello@asorkarssoap.in", "+91 98765 10314");
    db.prepare("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)").run("Rhea Mehta", "rhea@studioelevate.in", "+91 98111 42018");
    db.prepare("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)").run("Arjun Kapoor", "arjun@northstarworks.in", "+91 98207 66109");
    db.prepare("INSERT INTO cards (company_name, customer_id, plan, card_status, payment_status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Asorkars Soap", 1, "Trial", "Active", "Pending", 999, "2026-08-18T10:00:00.000Z");
    db.prepare("INSERT INTO cards (company_name, customer_id, plan, card_status, payment_status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Studio Elevate", 2, "Professional", "Active", "Paid", 2499, "2026-08-02T10:00:00.000Z");
    db.prepare("INSERT INTO cards (company_name, customer_id, plan, card_status, payment_status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("Northstar Works", 3, "Professional", "Paused", "Paid", 2499, "2026-07-24T10:00:00.000Z");
    db.prepare("INSERT INTO payments (card_id, amount, payment_method, paid_at) VALUES (?, ?, ?, ?)").run(2, 2499, "UPI", "2026-08-02T10:00:00.000Z");
    db.prepare("INSERT INTO payments (card_id, amount, payment_method, paid_at) VALUES (?, ?, ?, ?)").run(3, 2499, "Card", "2026-07-24T10:00:00.000Z");
  });
  seed();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const cardQuery = `SELECT cards.*, customers.name AS customer_name, customers.email AS customer_email, customers.phone AS customer_phone FROM cards JOIN customers ON customers.id = cards.customer_id`;

app.get("/health", (_req, res) => res.type("text").send("ok\n"));
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "asorkar@gmail.com" && password === "1234") return res.json({ name: "Asorkar", role: "Administrator" });
  return res.status(401).json({ error: "Use the local demonstration credentials to sign in." });
});
app.get("/api/summary", (_req, res) => res.json({
  cards: db.prepare("SELECT COUNT(*) AS count FROM cards").get().count,
  customers: db.prepare("SELECT COUNT(*) AS count FROM customers").get().count,
  active: db.prepare("SELECT COUNT(*) AS count FROM cards WHERE card_status = 'Active'").get().count,
  pending: db.prepare("SELECT COUNT(*) AS count FROM cards WHERE payment_status != 'Paid'").get().count
}));
app.get("/api/cards", (_req, res) => res.json(db.prepare(`${cardQuery} ORDER BY cards.id DESC`).all()));
app.get("/api/customers", (_req, res) => res.json(db.prepare("SELECT * FROM customers ORDER BY id DESC").all()));
app.get("/api/payments", (_req, res) => res.json(db.prepare("SELECT payments.*, cards.company_name FROM payments JOIN cards ON cards.id = payments.card_id ORDER BY paid_at DESC").all()));
app.post("/api/cards", (req, res) => {
  const { companyName, customerName, email, phone, plan = "Trial" } = req.body;
  if (![companyName, customerName, email, phone].every(Boolean)) return res.status(400).json({ error: "Complete all customer and card details." });
  let customer = db.prepare("SELECT id FROM customers WHERE email = ?").get(email);
  if (!customer) customer = { id: db.prepare("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)").run(customerName, email, phone).lastInsertRowid };
  const amount = plan === "Professional" ? 2499 : plan === "Business" ? 4999 : 999;
  const result = db.prepare("INSERT INTO cards (company_name, customer_id, plan, card_status, payment_status, amount) VALUES (?, ?, ?, 'Active', 'Pending', ?)").run(companyName, customer.id, plan, amount);
  res.status(201).json(db.prepare(`${cardQuery} WHERE cards.id = ?`).get(result.lastInsertRowid));
});
app.patch("/api/cards/:id", (req, res) => {
  const { cardStatus, paymentStatus } = req.body;
  db.prepare("UPDATE cards SET card_status = COALESCE(?, card_status), payment_status = COALESCE(?, payment_status) WHERE id = ?").run(cardStatus || null, paymentStatus || null, req.params.id);
  res.json(db.prepare(`${cardQuery} WHERE cards.id = ?`).get(req.params.id));
});
app.post("/api/cards/:id/pay", (req, res) => {
  const card = db.prepare("SELECT * FROM cards WHERE id = ?").get(req.params.id);
  if (!card) return res.status(404).json({ error: "Card not found." });
  db.transaction(() => {
    db.prepare("INSERT INTO payments (card_id, amount, payment_method) VALUES (?, ?, ?)").run(card.id, card.amount, "Manual payment");
    db.prepare("UPDATE cards SET payment_status = 'Paid' WHERE id = ?").run(card.id);
  })();
  res.json({ success: true });
});

app.listen(port, "0.0.0.0", () => console.log(`CWDGE admin portal listening on ${port}`));
