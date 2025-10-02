const CART_KEY = 'ecom_cart_v1';
const RECENT_ORDERS_KEY = 'recent_orders';

function loadCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(productId, name, price, qty = 1) {
  const cart = loadCart();
  const existing = cart.find(i => i.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ productId, name, price, quantity: qty });
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  const cart = loadCart().filter(i => i.productId !== productId);
  saveCart(cart);
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartCount();
}

function getCartTotal() {
  return loadCart().reduce((s, i) => s + (i.price * i.quantity), 0);
}

// ---- New: Cart Counter Badge ----
function updateCartCount() {
  const cart = loadCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = count;
}

// ---- New: Recent Orders Management ----
function saveRecentOrder(order) {
  const recentOrders = JSON.parse(localStorage.getItem(RECENT_ORDERS_KEY) || '[]');
  
  // Check if order already exists
  const existingIndex = recentOrders.findIndex(o => o.id === order.id);
  if (existingIndex !== -1) {
    // Update existing order
    recentOrders[existingIndex] = order;
  } else {
    // Add new order at the beginning
    recentOrders.unshift(order);
  }
  
  // Keep only the 5 most recent orders
  if (recentOrders.length > 5) {
    recentOrders.splice(5);
  }
  
  localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(recentOrders));
}

function loadRecentOrders() {
  return JSON.parse(localStorage.getItem(RECENT_ORDERS_KEY) || '[]');
}

// ---- New: Order Tracking ----
function trackOrder(orderId) {
  if (orderId) {
    window.location.href = `/order-status.html?id=${orderId}`;
  } else {
    alert('Please enter a valid order ID');
  }
}

// ---- New: Save Order After Checkout ----
function saveOrderAfterCheckout(orderData) {
  // Save order to recent orders
  saveRecentOrder({
    id: orderData.orderId,
    date: new Date().toISOString(),
    total: orderData.total,
    status: 'pending'
  });
  
  // Clear cart
  clearCart();
}

// Ensure badge updates when page loads
document.addEventListener("DOMContentLoaded", updateCartCount);

// Make functions available globally
window.saveOrderAfterCheckout = saveOrderAfterCheckout;
window.trackOrder = trackOrder;
