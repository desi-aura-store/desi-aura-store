// frontend/assets/js/api.js

// Get the base URL from config or use fallback
const base = window.API_BASE_URL || 'https://desi-aura-backend.onrender.com';

// Debug logging - remove in production
console.log('API Base URL in api.js:', base);

// Helper function for handling API responses
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
}

// Helper function for logging API calls
function logApiCall(method, url, data = null) {
  console.log(`[API] ${method} ${url}`, data ? `Data: ${JSON.stringify(data)}` : '');
}

const API = {
  // Get products with optional category filter
  getProducts: async (category = null, limit = 12, offset = 0) => {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      params.append('limit', limit);
      params.append('offset', offset);
      
      const url = `${base}/api/products?${params.toString()}`;
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      const data = await handleResponse(response);
      
      console.log('[API] Products response:', data);
      return data;
    } catch (error) {
      console.error('[API] Error fetching products:', error);
      throw error;
    }
  },

  // Get single product by ID
  getProduct: async (id) => {
    try {
      if (!id) {
        throw new Error('Product ID is required');
      }
      
      const url = `${base}/api/products/${id}`;
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      const data = await handleResponse(response);
      
      console.log('[API] Product response:', data);
      return data;
    } catch (error) {
      console.error('[API] Error fetching product:', error);
      throw error;
    }
  },

  // Create new order
  createOrder: async (order) => {
    try {
      // Validate order data
      if (!order || !order.customerName || !order.address || !order.items) {
        throw new Error('Invalid order data');
      }
      
      const url = `${base}/api/orders`;
      logApiCall('POST', url, order);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(order),
        mode: 'cors',
        credentials: 'omit'
      });
      
      const data = await handleResponse(response);
      
      console.log('[API] Order creation response:', data);
      return data;
    } catch (error) {
      console.error('[API] Error creating order:', error);
      throw error;
    }
  },

  // Get order by ID
  getOrder: async (id) => {
    try {
      if (!id) {
        throw new Error('Order ID is required');
      }
      
      const url = `${base}/api/orders/${id}`;
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      const data = await handleResponse(response);
      
      console.log('[API] Order response:', data);
      return data;
    } catch (error) {
      console.error('[API] Error fetching order:', error);
      throw error;
    }
  },

  // Health check endpoint
  healthCheck: async () => {
    try {
      const url = `${base}/api/health`;
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      const data = await handleResponse(response);
      
      console.log('[API] Health check response:', data);
      return data;
    } catch (error) {
      console.error('[API] Error during health check:', error);
      throw error;
    }
  }
};

// Expose globally
window.API = API;

// Also expose the helper functions from config.js for compatibility
window.fetchProducts = API.getProducts;
window.fetchProduct = API.getProduct;

// Add a global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[API] Unhandled promise rejection:', event.reason);
  // Optionally show a user-friendly message
  if (window.showErrorMessage) {
    window.showErrorMessage('Network error. Please check your connection and try again.');
  }
});

// Add a function to check API connectivity
window.checkApiConnectivity = async function() {
  try {
    await API.healthCheck();
    console.log('[API] Backend connectivity: Connected');
    return true;
  } catch (error) {
    console.error('[API] Connectivity check failed:', error);
    return false;
  }
};

// Check connectivity on page load
if (document.readyState === 'complete') {
  window.checkApiConnectivity();
} else {
  window.addEventListener('load', () => {
    window.checkApiConnectivity();
  });
}
