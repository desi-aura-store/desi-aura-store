const path = require("path");
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
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

// Initialize Brevo API client
let emailConfigured = false;

function setupBrevoAPI() {
  try {
    // Check if required environment variables are set
    if (!process.env.BREVO_API_KEY) {
      console.error('❌ BREVO_API_KEY not found in environment variables');
      return false;
    }
    
    if (!process.env.BREVO_EMAIL) {
      console.error('❌ BREVO_EMAIL not found in environment variables');
      return false;
    }
    
    console.log('✅ Brevo API configured');
    console.log(`   Sender Email: ${process.env.BREVO_EMAIL}`);
    console.log(`   API Key: ${process.env.BREVO_API_KEY.substring(0, 8)}...`);
    
    emailConfigured = true;
    return true;
  } catch (error) {
    console.error('❌ Failed to setup Brevo API:', error.message);
    return false;
  }
}

// Setup Brevo API
setupBrevoAPI();

// Function to send email using Brevo API
async function sendEmailViaBrevoAPI(to, subject, textContent, htmlContent) {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'Desi Aura',
          email: process.env.BREVO_EMAIL
        },
        to: [{ email: to }],
        subject: subject,
        textContent: textContent,
        htmlContent: htmlContent
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY
        }
      }
    );
    
    console.log('✅ Email sent successfully via Brevo API');
    console.log(`   Message ID: ${response.data.messageId}`);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    console.error('❌ Failed to send email via Brevo API:', error.response?.data || error.message);
    throw error;
  }
}

// Generate a shorter order ID (8 characters)
function generateOrderId() {
  return 'ORD-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Sync DB and run seed if needed
(async () => {
  try {
    await sequelize.sync({ force: false }); // Changed to false to preserve data
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
    emailConfigured: emailConfigured,
    brevoEmail: process.env.BREVO_EMAIL ? 'configured' : 'not configured',
    brevoApiKey: process.env.BREVO_API_KEY ? 'configured' : 'not configured'
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
        emailConfigured: emailConfigured,
        brevoEmail: process.env.BREVO_EMAIL ? 'configured' : 'not configured',
        brevoApiKey: process.env.BREVO_API_KEY ? 'configured' : 'not configured'
      });
    }

    const testEmail = process.env.NOTIFY_EMAIL || 'vivekkomirelli@gmail.com';
    console.log(`Sending test email to: ${testEmail}`);

    const result = await sendEmailViaBrevoAPI(
      testEmail,
      'Test Email from Desi Aura',
      'This is a test email from Desi Aura backend. If you receive this, email configuration is working correctly.'
    );
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: result.messageId
    });
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.response?.data?.message || error.message
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

    // Generate a shorter order ID (8 characters)
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
        ...detailedItems.map(i => `${i.quantity}x ${i.name} — ₹${i.lineTotal.toFixed(2)}`),
        '',
        `View order details: https://desi-aura-store.vercel.app/order-status.html?id=${orderId}`
      ].join('\n');

      const adminEmailHtml = `
        <h2>New order received — #${orderId}</h2>
        <p><strong>Name:</strong> ${customerName}</p>
        <p><strong>Phone:</strong> ${customerPhone || 'N/A'}</p>
        <p><strong>Email:</strong> ${customerEmail || 'N/A'}</p>
        <p><strong>Address:</strong> ${address}</p>
        <p><strong>Total:</strong> ₹${total.toFixed(2)}</p>
        <h3>Items:</h3>
        <ul>
          ${detailedItems.map(i => `<li>${i.quantity}x ${i.name} — ₹${i.lineTotal.toFixed(2)}</li>`).join('')}
        </ul>
        <p><a href="https://desi-aura-store.vercel.app/order-status.html?id=${orderId}">View order details</a></p>
      `;

      try {
        await sendEmailViaBrevoAPI(
          notifyTo,
          `New order #${orderId}`,
          adminEmailContent,
          adminEmailHtml
        );
        console.log('✅ Admin notification sent successfully to:', notifyTo);
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
        `Track your order: https://desi-aura-store.vercel.app/order-status.html?id=${orderId}`,
        ``,
        `Thank you for shopping with Desi Aura!`,
        ``,
        `Best regards,`,
        `Desi Aura Team`
      ].join('\n');

      const customerEmailHtml = `
        <h2>Thank you for your order with Desi Aura!</h2>
        <p>Dear ${customerName},</p>
        <h3>Order Details:</h3>
        <p><strong>Order ID:</strong> #${orderId}</p>
        <h3>Items:</h3>
        <ul>
          ${detailedItems.map(i => `<li>${i.quantity}x ${i.name} - ₹${i.lineTotal.toFixed(2)}</li>`).join('')}
        </ul>
        <p><strong>Total:</strong> ₹${total.toFixed(2)}</p>
        <h3>Shipping Address:</h3>
        <p>${address}</p>
        <p><strong>Payment Method:</strong> Cash on Delivery</p>
        <p>We'll process your order soon and deliver it to your address.</p>
        <p><a href="https://desi-aura-store.vercel.app/order-status.html?id=${orderId}">Track your order</a></p>
        <p>Thank you for shopping with Desi Aura!</p>
        <p>Best regards,<br>Desi Aura Team</p>
      `;

      try {
        await sendEmailViaBrevoAPI(
          customerEmail,
          `Order Confirmation - Desi Aura #${orderId}`,
          customerEmailContent,
          customerEmailHtml
        );
        console.log('✅ Customer confirmation sent successfully to:', customerEmail);
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
