// frontend/assets/js/config.js

// Detect host automatically (works for localhost, LAN IP, or deployed domain)
const host = window.location.hostname;
const port = 3000; // dev backend port

// If we're on localhost or LAN, add :3000
// If deployed (production), assume backend runs on same host as frontend
if (host === 'localhost' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
  window.API_BASE_URL = `http://${host}:${port}/api`;
} else {
  window.API_BASE_URL = `${window.location.origin}/api`;
}

window.API_BASE = window.API_BASE_URL; // alias for older code

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
