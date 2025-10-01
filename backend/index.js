// backend/index.js
const path = require("path");
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { sequelize, Product, Order } = require('./models');

const PORT = process.env.PORT || 10000; // Render uses port 10000
const app = express();
app.use(bodyParser.json());

// CORS configuration for Render
app.use(cors({
  origin: ['https://desi-aura-store.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Initialize Mailtrap transporter
let transporter;
let emailConfigured = false;

if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
  transporter = nodemailer.createTransport({
    host: "live.smtp.mailtrap.io",
    port: 587,
    auth: {
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS
    }
  });
  
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Mailtrap configuration failed:', error);
    } else {
      emailConfigured = true;
      console.log('✅ Mailtrap email service configured');
    }
  });
} else {
  console.warn('⚠️ MAILTRAP_USER or MAILTRAP_PASS not set. Email notifications will not work.');
}

// Generate a random order ID
function generateOrderId() {
  return 'ORD-' + Math.random().toString(36).substring(2, 15).toUpperCase() + 
         '-' + Date.now().toString(36).substring(4, 10).toUpperCase();
}

// Sync DB and run seed if needed
(async () => {
  try {
    await sequelize.sync({ force: true }); // Use force: true to recreate tables with new structure
    console.log('DB synced');
    
    // Check if we need to seed the database
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('No products found, running seed...');
      const { seed } = require('./seed');
      await seed();
      console.log('Database seeded successfully');
    }
  } catch (err) {
    console.error('DB sync/seed error:', err);
  }
})();

// Add a lightweight ping endpoint for pingers
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('[API] /api/health called');
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    emailConfigured: emailConfigured
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  console.log('[API] /api called');
  res.json({
    message: 'Desi Aura API Server',
    version: '1.0.0',
    platform: 'Render',
    endpoints: [
      'GET /api/products',
      'GET /api/products/:id',
      'POST /api/orders',
      'GET /api/orders/:id',
      'GET /api/health',
      'GET /api/ping',
      'GET /api/test-email'
    ],
    emailConfigured: emailConfigured
  });
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    if (!emailConfigured) {
      return res.status(500).json({ 
        error: 'Email service not configured',
        emailConfigured: emailConfigured
      });
    }
    
    const testEmail = process.env.NOTIFY_EMAIL || 'vivekkomirelli@gmail.com';
    console.log(`Sending test email to: ${testEmail}`);
    
    const mailOptions = {
      from: 'hello@demomailtrap.com',
      to: testEmail,
      subject: 'Test Email from Desi Aura',
      text: 'This is a test email from Desi Aura backend. If you receive this, email configuration is working correctly.'
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully:', result.messageId);
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      emailId: result.messageId
    });
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message
    });
  }
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

    // Generate a random order ID
    const orderId = generateOrderId();
    
    const order = await Order.create({
      id: orderId, // Use the generated order ID
      customerName, 
      customerEmail, 
      customerPhone, 
      address,
      items: JSON.stringify(detailedItems),
      total
    }, { transaction });

    await transaction.commit();

    console.log(`[API] Order created with ID: ${orderId}`);

    // Admin notification
    const notifyTo = process.env.NOTIFY_EMAIL || 'vivekkomirelli@gmail.com';
    if (emailConfigured) {
      console.log(`Sending admin notification to: ${notifyTo}`);
      
      const adminEmailContent = [
        `New order received — #${orderId}`,
        `Name: ${customerName}`,
        `Phone: ${customerPhone || 'N/A'}`,
        `Email: ${customerEmail || 'N/A'}`,
        `Address: ${address}`,
        `Total: ₹${total.toFixed(2)}`,
        '',
        'Items:',
        ...detailedItems.map(i => `${i.quantity}x ${i.name} — ₹${i.lineTotal.toFixed(2)}`)
      ].join('\n');

      try {
        const mailOptions = {
          from: 'hello@demomailtrap.com',
          to: notifyTo,
          subject: `New order #${orderId}`,
          text: adminEmailContent
        };
        
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Admin notification sent successfully to:', notifyTo, 'Message ID:', result.messageId);
      } catch (err) {
        console.error('❌ Failed to send admin notification:', err);
      }
    } else {
      console.warn('Email not configured; skipping admin email.');
    }

    // Customer order confirmation email
    if (emailConfigured && customerEmail) {
      console.log(`Sending customer confirmation to: ${customerEmail}`);
      
      const customerEmailContent = [
        `Dear ${customerName},`,
        ``,
        `Thank you for your order with Desi Aura!`,
        ``,
        `Order Details:`,
        `Order ID: #${orderId}`,
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

      try {
        const mailOptions = {
          from: 'hello@demomailtrap.com',
          to: customerEmail,
          subject: `Order Confirmation - Desi Aura #${orderId}`,
          text: customerEmailContent
        };
        
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Customer confirmation sent successfully to:', customerEmail, 'Message ID:', result.messageId);
      } catch (err) {
        console.error('❌ Failed to send customer confirmation:', err);
      }
    } else {
      console.warn('Email not configured or customer email not provided; skipping customer email.');
    }

    res.json({ success: true, orderId: orderId });
    
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
