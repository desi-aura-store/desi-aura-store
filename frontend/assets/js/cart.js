// frontend/assets/js/cart.js
const CART_KEY = 'ecom_cart_v1';

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

// Ensure badge updates when page loads
document.addEventListener("DOMContentLoaded", updateCartCount);
