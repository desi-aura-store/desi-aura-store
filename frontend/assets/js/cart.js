const CART_KEY = 'ecom_cart_v1';
const ORDER_HISTORY_KEY = 'desi_aura_order_history';

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

// ---- New: Order History ----
function saveOrderToHistory(orderData) {
  const orderHistory = getOrderHistory();
  orderHistory.push(orderData);
  // Keep only the last 10 orders
  if (orderHistory.length > 10) {
    orderHistory.shift();
  }
  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orderHistory));
}

function getOrderHistory() {
  const raw = localStorage.getItem(ORDER_HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Sanitize HTML to prevent XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayRecentOrders() {
  const orderHistory = getOrderHistory();
  const recentOrdersSection = document.getElementById('recent-orders');
  
  if (!recentOrdersSection) return;
  
  if (orderHistory.length === 0) {
    recentOrdersSection.innerHTML = `
      <p>You don't have any recent orders.</p>
      <a href="/shop.html" class="continue-shopping">Start Shopping</a>
    `;
    return;
  }
  
  recentOrdersSection.innerHTML = `
    <h3>Recent Orders</h3>
    <div class="recent-orders-list">
      ${orderHistory.slice(0, 3).map(order => `
        <div class="recent-order-item">
          <div class="order-info">
            <div class="order-id">Order #${escapeHtml(order.id)}</div>
            <div class="order-date">${new Date(order.createdAt).toLocaleDateString()}</div>
            <div class="order-status">${escapeHtml(order.status || 'Processing')}</div>
          </div>
          <a href="/order-status.html?id=${encodeURIComponent(order.id)}" class="track-order-btn">Track</a>
        </div>
      `).join('')}
    </div>
    <a href="/order-status.html" class="view-all-orders">View All Orders</a>
  `;
}

// Save order when checkout is successful
function saveOrderAfterCheckout(orderData) {
  saveOrderToHistory(orderData);
  clearCart();
}

// Ensure badge updates when page loads
document.addEventListener("DOMContentLoaded", function() {
  updateCartCount();
  
  // Display recent orders if we're on the cart page
  if (window.location.pathname.includes('cart.html')) {
    displayRecentOrders();
  }
});
