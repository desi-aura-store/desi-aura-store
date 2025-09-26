// frontend/assets/js/router.js

// Function to navigate to a new page
function navigateTo(url) {
  // Extract the path from the URL
  const path = new URL(url).pathname;
  
  // Handle navigation based on the path
  switch(path) {
    case '/':
    case '/index.html':
      window.location.href = '/index.html';
      break;
    case '/shop.html':
      window.location.href = '/shop.html';
      break;
    case '/product.html':
      window.location.href = '/product.html';
      break;
    case '/cart.html':
      window.location.href = '/cart.html';
      break;
    // Add other cases as needed
    default:
      // For any other path, try to navigate directly
      window.location.href = url;
  }
}

// Handle navigation clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href.startsWith(window.location.origin)) {
    // Don't handle navigation for product links with IDs or checkout links
    if (link.href.includes('product.html?id=') || 
        link.href.includes('checkout.html') ||
        link.href.includes('shop.html?category=')) {
      return; // Let the browser handle these links normally
    }
    e.preventDefault();
    navigateTo(link.href);
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Update the active navigation link
  updateActiveNavLink(window.location.pathname);
});

// Function to update active navigation link
function updateActiveNavLink(path) {
  // Remove active class from all links
  document.querySelectorAll('nav a').forEach(link => {
    link.classList.remove('active');
  });
  
  // Add active class to current page link
  const currentPage = path.split('/').pop().replace('.html', '') || 'index';
  const activeLink = document.querySelector(`nav a[href="/${currentPage}.html"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}