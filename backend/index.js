// backend/index.js
const path = require("path");
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { sequelize, Product, Order } = require('./models');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.json());

// Simplified CORS configuration for same-origin
app.use(cors());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// SERVE STATIC FILES FROM FRONTEND DIRECTORY
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes to serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/shop.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/shop.html'));
});

app.get('/product.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/product.html'));
});

app.get('/cart.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/cart.html'));
});

// Nodemailer transporter: Gmail or fallback
let transporter;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  });
} else {
  console.warn('GMAIL_USER / GMAIL_PASS not set. Emails will not be sent.');
}

// Sync DB
(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('DB synced');
  } catch (err) {
    console.error('DB sync error:', err);
  }
})();

// API Routes - Define these AFTER static file serving

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('[API] /api/health called');
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  console.log('[API] /api called');
  res.json({
    message: 'Desi Aura API Server',
    version: '1.0.0',
    endpoints: [
      'GET /api/products',
      'GET /api/products/:id',
      'POST /api/orders',
      'GET /api/orders/:id',
      'GET /api/health'
    ]
  });
});

// Products endpoints
app.get('/api/products', async (req, res) => {
  try {
    console.log('[API] /api/products called with query:', req.query);
    
    const where = {};
    if (req.query.category) where.category = req.query.category;

    const limit = Math.max(1, parseInt(req.query.limit) || 12);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    console.log(`[API] /api/products limit=${limit} offset=${offset} category=${req.query.category || 'none'}`);

    const products = await Product.findAll({ where, limit, offset });
    console.log(`[API] Found ${products.length} products`);
    
    return res.json(products);
  } catch (err) {
    console.error('[ERR] /api/products', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    console.log(`[API] /api/products/${req.params.id} called`);
    
    const p = await Product.findByPk(req.params.id);
    
    if (!p) {
      console.log(`[API] Product with ID ${req.params.id} not found`);
      return res.status(404).json({ error: 'Not found' });
    }
    
    console.log(`[API] Found product:`, p.name);
    res.json(p);
  } catch (err) {
    console.error(`[ERR] /api/products/${req.params.id}`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Orders endpoints
app.post('/api/orders', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('[API] /api/orders called with body:', req.body);
    
    const { customerName, customerEmail, customerPhone, address, items } = req.body;
    
    if (!customerName || !address || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid order payload' });
    }

    const productIds = items.map(item => item.productId);
    
    const products = await Product.findAll({
      where: { id: productIds },
      transaction
    });
    
    const productMap = {};
    products.forEach(product => {
      productMap[product.id] = product;
    });
    
    let total = 0;
    const detailedItems = [];
    
    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      
      const qty = parseInt(item.quantity) || 1;
      const lineTotal = Number(product.price) * qty;
      total += lineTotal;
      
      detailedItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        lineTotal
      });
    }

    const order = await Order.create({
      customerName, 
      customerEmail, 
      customerPhone, 
      address,
      items: JSON.stringify(detailedItems),
      total
    }, { transaction });

    await transaction.commit();

    console.log(`[API] Order created with ID: ${order.id}`);

    // Admin notification (existing code)
    const notifyTo = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER;
    if (transporter && notifyTo) {
      const adminEmailContent = [
        `New order received — #${order.id}`,
        `Name: ${customerName}`,
        `Phone: ${customerPhone || 'N/A'}`,
        `Email: ${customerEmail || 'N/A'}`,
        `Address: ${address}`,
        `Total: ₹${total.toFixed(2)}`,
        '',
        'Items:',
        ...detailedItems.map(i => `${i.quantity}x ${i.name} — ₹${i.lineTotal.toFixed(2)}`)
      ].join('\n');

      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: notifyTo,
        subject: `New order #${order.id}`,
        text: adminEmailContent
      }).catch(err => console.error('Admin email error:', err));
    } else {
      console.warn('No transporter or notify email configured; skipping admin email.');
    }

    // Customer order confirmation email
    if (transporter && customerEmail) {
      const customerEmailContent = [
        `Dear ${customerName},`,
        ``,
        `Thank you for your order with Desi Aura!`,
        ``,
        `Order Details:`,
        `Order ID: #${order.id}`,
        ``,
        `Items:`,
        ...detailedItems.map(i => `${i.quantity}x ${i.name} - ₹${i.lineTotal.toFixed(2)}`),
        ``,
        `Total: ₹${total.toFixed(2)}`,
        ``,
        `Shipping Address:`,
        address,
        ``,
        `Payment Method: Cash on Delivery`,
        ``,
        `We'll process your order soon and deliver it to your address.`,
        ``,
        `Thank you for shopping with Desi Aura!`,
        ``,
        `Best regards,`,
        `Desi Aura Team`
      ].join('\n');

      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: customerEmail,
        subject: `Order Confirmation - Desi Aura #${order.id}`,
        text: customerEmailContent
      }).catch(err => console.error('Customer email error:', err));
    } else {
      console.warn('No transporter or customer email configured; skipping customer email.');
    }

    res.json({ success: true, orderId: order.id });
    
  } catch (err) {
    await transaction.rollback();
    console.error('[ERR] /api/orders', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    console.log(`[API] /api/orders/${req.params.id} called`);
    
    const order = await Order.findByPk(req.params.id);
    
    if (!order) {
      console.log(`[API] Order with ID ${req.params.id} not found`);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const parsedItems = JSON.parse(order.items);
    res.json({ 
      id: order.id, 
      customerName: order.customerName, 
      customerEmail: order.customerEmail, 
      customerPhone: order.customerPhone, 
      address: order.address, 
      items: parsedItems, 
      total: order.total, 
      status: order.status, 
      createdAt: order.createdAt 
    });
  } catch (err) {
    console.error(`[ERR] /api/orders/${req.params.id}`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Access your application at: http://localhost:${PORT}`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api`);
});