// backend/index.js
const path = require("path");
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { sequelize, Product, Order } = require('./models');

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';


const app = express();
app.use(bodyParser.json());
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL   // only allow prod frontend
    : '*',                       // allow everything in dev
};

app.use(cors(corsOptions));



// Nodemailer transporter: Gmail or fallback
let transporter;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  });
} else {
  console.warn('GMAIL_USER / GMAIL_PASS not set. Emails will not be sent.');
}

// Sync DB
(async () => {
  await sequelize.sync({ alter: true });
  console.log('DB synced');
})();

// Routes
// debug logging middleware (place near top, after app created)
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// paginated products with logging
app.get('/api/products', async (req, res) => {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;

    const limit = Math.max(1, parseInt(req.query.limit) || 12);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    console.log(`[API] /api/products limit=${limit} offset=${offset} category=${req.query.category || 'none'}`);

    const products = await Product.findAll({ where, limit, offset });
    return res.json(products);
  } catch (err) {
    console.error('[ERR] /api/products', err);
    return res.status(500).json({ error: 'Server error' });
  }
});



app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, address, items } = req.body;
    if (!customerName || !address || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid order payload' });
    }

    // Validate items against DB and compute total server-side
    let total = 0;
    const detailedItems = [];
    for (const it of items) {
      const product = await Product.findByPk(it.productId);
      if (!product) return res.status(400).json({ error: `Product ${it.productId} not found` });
      const qty = parseInt(it.quantity) || 1;
      const lineTotal = Number(product.price) * qty;
      total += lineTotal;
      detailedItems.push({
  productId: product.id,
  name: product.name,     // ✅ match models.js
  price: product.price,
  quantity: qty,
  lineTotal
});

    }

    const order = await Order.create({
      customerName, customerEmail, customerPhone, address,
      items: JSON.stringify(detailedItems),
      total
    });

    // Send notification email
    const notifyTo = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER;
    if (transporter && notifyTo) {
      const textLines = [
        `New order received — #${order.id}`,
        `Name: ${customerName}`,
        `Phone: ${customerPhone || 'N/A'}`,
        `Email: ${customerEmail || 'N/A'}`,
        `Address: ${address}`,
        `Total: $${total.toFixed(2)}`,
        '',
        'Items:',
        ...detailedItems.map(i => `${i.quantity}x ${i.name} — $${i.lineTotal.toFixed(2)}`)
      ].join('\n');

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: notifyTo,
        subject: `New order #${order.id}`,
        text: textLines
      }).catch(err => console.error('Email error:', err));
    } else {
      console.warn('No transporter or notify email configured; skipping email.');
    }

    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const parsedItems = JSON.parse(order.items);
    res.json({ id: order.id, customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone, address: order.address, items: parsedItems, total: order.total, status: order.status, createdAt: order.createdAt });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Catch-all to handle direct navigation (e.g. /product.html?id=1)


app.get("/product", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/product.html"));
});

app.get("/shop", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/shop.html"));
});

app.get("/cart", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/cart.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
