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

const customerColumns = db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name);
const cardColumns = db.prepare("PRAGMA table_info(cards)").all().map((column) => column.name);
if (!customerColumns.includes("password")) db.exec("ALTER TABLE customers ADD COLUMN password TEXT");
if (!cardColumns.includes("selected_theme")) db.exec("ALTER TABLE cards ADD COLUMN selected_theme TEXT NOT NULL DEFAULT 'Ocean'");
const cardProfileColumns = ["logo_url", "first_name", "last_name", "designation", "alternate_phone", "whatsapp", "address", "website", "location", "established_on", "about_us"];
for (const column of cardProfileColumns) {
  if (!cardColumns.includes(column)) db.exec(`ALTER TABLE cards ADD COLUMN ${column} TEXT`);
}

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
  if (email === "admin@admin.com" && password === "123456789") return res.json({ name: "Asorkar", role: "Administrator" });
  return res.status(401).json({ error: "Use the local demonstration credentials to sign in." });
});
app.post("/api/customer/register", (req, res) => {
  const { name, email, phone, password, companyName } = req.body;
  if (![name, email, phone, password, companyName].every(Boolean)) return res.status(400).json({ error: "Complete all registration fields." });
  if (db.prepare("SELECT id FROM customers WHERE email = ?").get(email)) return res.status(409).json({ error: "An account already exists for this email." });
  const result = db.transaction(() => {
    const customer = db.prepare("INSERT INTO customers (name, email, phone, password) VALUES (?, ?, ?, ?)").run(name, email, phone, password);
    const card = db.prepare("INSERT INTO cards (company_name, customer_id, plan, card_status, payment_status, amount) VALUES (?, ?, 'Trial', 'Active', 'Pending', 999)").run(companyName, customer.lastInsertRowid);
    return { customerId: customer.lastInsertRowid, cardId: card.lastInsertRowid };
  })();
  res.status(201).json({ name, email, cardId: result.cardId });
});
app.post("/api/customer/login", (req, res) => {
  const { email, password } = req.body;
  const customer = db.prepare("SELECT id, name, email FROM customers WHERE email = ? AND password = ?").get(email, password);
  if (!customer) return res.status(401).json({ error: "Incorrect customer email or password." });
  res.json(customer);
});
app.get("/api/customer/cards", (req, res) => {
  const customer = db.prepare("SELECT id FROM customers WHERE email = ?").get(req.query.email);
  if (!customer) return res.status(404).json({ error: "Customer account not found." });
  res.json(db.prepare("SELECT cards.*, customers.phone FROM cards JOIN customers ON customers.id = cards.customer_id WHERE cards.customer_id = ? ORDER BY cards.id DESC").all(customer.id));
});
app.get("/api/summary", (_req, res) => res.json({
  cards: db.prepare("SELECT COUNT(*) AS count FROM cards").get().count,
  customers: db.prepare("SELECT COUNT(*) AS count FROM customers").get().count,
  active: db.prepare("SELECT COUNT(*) AS count FROM cards WHERE card_status = 'Active'").get().count,
  pending: db.prepare("SELECT COUNT(*) AS count FROM cards WHERE payment_status != 'Paid'").get().count
}));
app.get("/api/cards", (_req, res) => res.json(db.prepare(`${cardQuery} ORDER BY cards.id DESC`).all()));
app.get("/api/cards/export.csv", (_req, res) => {
  const columns = ["Card ID", "Company Name", "Customer Name", "Customer Email", "Customer Phone", "Plan", "Theme", "Card Status", "Payment Status", "Amount (INR)", "Created At"];
  const csvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = db.prepare(`${cardQuery} ORDER BY cards.id DESC`).all().map((card) => [
    card.id, card.company_name, card.customer_name, card.customer_email, card.customer_phone,
    card.plan, card.selected_theme, card.card_status, card.payment_status, card.amount, card.created_at
  ].map(csvValue).join(","));
  res.attachment("cwdge-managed-cards.csv").type("text/csv").send([columns.map(csvValue).join(","), ...rows].join("\n"));
});
app.get("/api/customers", (_req, res) => res.json(db.prepare("SELECT * FROM customers ORDER BY id DESC").all()));
app.get("/api/payments", (_req, res) => res.json(db.prepare("SELECT payments.*, cards.company_name FROM payments JOIN cards ON cards.id = payments.card_id ORDER BY paid_at DESC").all()));
app.get("/api/search", (req, res) => {
  const term = `%${String(req.query.q || "").trim()}%`;
  if (term === "%%") return res.json([]);
  res.json(db.prepare(`${cardQuery} WHERE cards.company_name LIKE ? OR customers.name LIKE ? OR customers.email LIKE ? ORDER BY cards.id DESC`).all(term, term, term));
});
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
app.patch("/api/customer/cards/:id/theme", (req, res) => {
  const { theme } = req.body;
  if (!["Ocean", "Forest", "Berry", "Monochrome"].includes(theme)) return res.status(400).json({ error: "Select a valid card theme." });
  db.prepare("UPDATE cards SET selected_theme = ? WHERE id = ?").run(theme, req.params.id);
  res.json({ success: true, theme });
});
app.patch("/api/customer/cards/:id/details", (req, res) => {
  const { companyName, logoUrl, firstName, lastName, designation, phone, alternatePhone, whatsapp, address, website, location, establishedOn, aboutUs } = req.body;
  if (![companyName, firstName, designation, phone, address, aboutUs].every(Boolean)) return res.status(400).json({ error: "Complete the required company details." });
  const result = db.transaction(() => {
    const cardUpdate = db.prepare(`UPDATE cards SET company_name = ?, logo_url = ?, first_name = ?, last_name = ?, designation = ?, alternate_phone = ?, whatsapp = ?, address = ?, website = ?, location = ?, established_on = ?, about_us = ? WHERE id = ?`).run(companyName, logoUrl || null, firstName, lastName || null, designation, alternatePhone || null, whatsapp || null, address, website || null, location || null, establishedOn || null, aboutUs, req.params.id);
    db.prepare("UPDATE customers SET phone = ? WHERE id = (SELECT customer_id FROM cards WHERE id = ?)").run(phone, req.params.id);
    return cardUpdate;
  })();
  if (!result.changes) return res.status(404).json({ error: "Card not found." });
  res.json(db.prepare("SELECT * FROM cards WHERE id = ?").get(req.params.id));
});

app.listen(port, "0.0.0.0", () => console.log(`CWDGE admin portal listening on ${port}`));
