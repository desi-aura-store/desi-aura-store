// frontend/assets/js/config.js

// Since both frontend and backend are now on the same port, use relative API path
window.API_BASE_URL = '/api';
window.API_BASE = window.API_BASE_URL; // alias for older code

// Debug logging - remove in production
console.log('API Base URL:', window.API_BASE_URL);

// Optional helpers
async function fetchProducts() {
  const res = await fetch(`${window.API_BASE_URL}/products`);
  return res.json();
}

async function fetchProduct(id) {
  const res = await fetch(`${window.API_BASE_URL}/products/${id}`);
  return res.json();
}

// helper: return FIRST image filename from p.image (supports CSV or pipe)
function firstImage(p) {
  if (!p || !p.image) return 'placeholder.jpg'; // fallback image filename
  // split by comma or pipe, trim whitespace, ignore empty
  const parts = String(p.image).split(/[|,]/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[0] : 'placeholder.jpg';
}

// make it global/available
window.firstImage = firstImage;