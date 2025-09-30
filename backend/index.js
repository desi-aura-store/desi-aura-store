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

// Nodemailer transporter with multiple configuration options
let transporter;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  // Remove any spaces from the password
  const sanitizedPassword = process.env.GMAIL_PASS.replace(/\s+/g, '');
  
  // Try multiple configuration options
  const configs = [
    // Option 1: Gmail with SSL (port 465)
    {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { 
        user: process.env.GMAIL_USER, 
        pass: sanitizedPassword 
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 5,
      rateLimit: 5,
      rateDelta: 1000,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    },
    // Option 2: Gmail with STARTTLS (port 587)
    {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { 
        user: process.env.GMAIL_USER, 
        pass: sanitizedPassword 
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 5,
      rateLimit: 5,
      rateDelta: 1000,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    },
    // Option 3: Alternative configuration with more relaxed settings
    {
      service: 'gmail',
      auth: { 
        user: process.env.GMAIL_USER, 
        pass: sanitizedPassword 
      },
      pool: true,
      maxConnections: 1,
      maxMessages: 5,
      connectionTimeout: 20000,
      tls: {
        rejectUnauthorized: false
      }
    }
  ];
  
  // Function to test transporter configuration
  const testTransporter = async (config, index) => {
    try {
      console.log(`Testing transporter configuration ${index + 1}...`);
      const testTransporter = nodemailer.createTransport(config);
      await testTransporter.verify();
      console.log(`Transporter configuration ${index + 1} verified successfully`);
      return testTransporter;
    } catch (error) {
      console.warn(`Transporter configuration ${index + 1} failed:`, error.message);
      return null;
    }
  };
  
  // Try each configuration until one works
  (async () => {
    for (let i = 0; i < configs.length; i++) {
      const testTransporterResult = await testTransporter(configs[i], i);
      if (testTransporterResult) {
        transporter = testTransporterResult;
        console.log(`Using transporter configuration ${i + 1}`);
        break;
      }
    }
    
    if (!transporter) {
      console.error('All transporter configurations failed. Email notifications will not work.');
    }
  })();
} else {
  console.warn('GMAIL_USER / GMAIL_PASS not set. Emails will not be sent.');
}

// Sync DB and run seed if needed
(async () => {
  try {
    await sequelize.sync({ alter: true });
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
    emailConfigured: !!transporter
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
    emailConfigured: !!transporter
  });
});

// Test email endpoint with retry mechanism
app.get('/api/test-email', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(500).json({ error: 'Email transporter not configured' });
    }
    
    const testEmail = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER;
    
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: testEmail,
      subject: 'Test Email from Desi Aura',
      text: 'This is a test email from Desi Aura backend. If you receive this, email configuration is working correctly.'
    };
    
    const result = await sendEmailWithRetry(mailOptions);
    console.log('Test email sent successfully:', result.messageId);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: result.messageId 
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message 
    });
  }
});

// Helper function to send email with retry
async function sendEmailWithRetry(mailOptions, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending email (attempt ${attempt}/${maxRetries})`);
      const result = await transporter.sendMail(mailOptions);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Email attempt ${attempt} failed:`, error.message);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

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

    // Admin notification with retry mechanism
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

      try {
        const adminMailOptions = {
          from: process.env.GMAIL_USER,
          to: notifyTo,
          subject: `New order #${order.id}`,
          text: adminEmailContent,
          headers: {
            'X-Priority': '1',
            'X-Mailer': 'DesiAuraMailer'
          }
        };
        
        await sendEmailWithRetry(adminMailOptions);
        console.log('Admin notification sent successfully');
      } catch (err) {
        console.error('Failed to send admin notification after retries:', err);
      }
    } else {
      console.warn('No transporter or notify email configured; skipping admin email.');
    }

    // Customer order confirmation email with retry mechanism
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

      try {
        const customerMailOptions = {
          from: process.env.GMAIL_USER,
          to: customerEmail,
          subject: `Order Confirmation - Desi Aura #${order.id}`,
          text: customerEmailContent,
          headers: {
            'X-Priority': '1',
            'X-Mailer': 'DesiAuraMailer'
          }
        };
        
        await sendEmailWithRetry(customerMailOptions);
        console.log('Customer confirmation sent successfully');
      } catch (err) {
        console.error('Failed to send customer confirmation after retries:', err);
      }
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
