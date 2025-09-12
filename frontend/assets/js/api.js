// assets/js/api.js
async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  return res.json();
}

async function fetchProduct(id) {
  const res = await fetch(`${API_BASE}/products/${id}`);
  return res.json();
}

// frontend/assets/js/api.js
const base = window.API_BASE_URL || window.API_BASE || 'http://localhost:3000/api';

const API = {
  getProducts: (category) => {
    const q = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetch(`${base}/products${q}`).then(r => r.json());
  },
  getProduct: (id) => fetch(`${base}/products/${id}`).then(r => r.json()),
  createOrder: (order) =>
    fetch(`${base}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    }).then(r => r.json()),
  getOrder: (id) => fetch(`${base}/orders/${id}`).then(r => r.json())
};

// expose globally
window.API = API;
