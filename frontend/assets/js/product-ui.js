// frontend/assets/js/product-ui.js
// Single shared UI for product cards: hover reveal, touch reveal, add/buy handlers.

(function () {
  if (window.__product_ui_installed) return;
  window.__product_ui_installed = true;

  const ACTION_SHOW_CLASS = 'show-actions';
  const HIDE_TIMEOUT = 5000; // ms to auto-hide on mobile
  
  // Variables to track touch events
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isScrolling = false;
  
  // Maximum movement allowed for a tap (in pixels)
  const TAP_THRESHOLD = 10;
  // Maximum time allowed for a tap (in milliseconds)
  const TAP_TIME_THRESHOLD = 300;

  // Utility: find product-card ancestor
  function findCard(el) {
    return el ? el.closest('.product-card') : null;
  }

  // Click delegation for Add / Buy buttons
  document.addEventListener('click', (ev) => {
    const addBtn = ev.target.closest('.add-btn');
    const buyBtn = ev.target.closest('.buy-btn');

    if (addBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      const id = Number(addBtn.dataset.id);
      const name = addBtn.dataset.name ? decodeURIComponent(addBtn.dataset.name) : '';
      const price = Number(addBtn.dataset.price || 0);

      if (typeof window.addToCart === 'function') {
        window.addToCart(id, name, price, 1);
      } else {
        console.warn('addToCart() not found.');
      }

      // lightweight visual feedback
      const orig = addBtn.textContent;
      addBtn.textContent = 'Added ✓';
      setTimeout(() => { addBtn.textContent = orig; }, 900);
      return;
    }

    if (buyBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      const id = Number(buyBtn.dataset.id);
      const name = buyBtn.dataset.name ? decodeURIComponent(buyBtn.dataset.name) : '';
      const price = Number(buyBtn.dataset.price || 0);

      if (typeof window.addToCart === 'function') {
        window.addToCart(id, name, price, 1);
      } else {
        console.warn('addToCart() not found (buy now).');
      }

      // go to checkout (your code uses checkout.html)
      window.location.href = 'checkout.html';
      return;
    }
  }, false);

  // Touch behavior: first tap reveals actions, second tap follows link
  let hideTimers = new WeakMap();
  let touchedCards = new WeakMap(); // Track which cards have been touched once

  function showActionsFor(card) {
    if (!card) return;
    card.classList.add(ACTION_SHOW_CLASS);
    // auto-hide after some time
    if (hideTimers.has(card)) {
      clearTimeout(hideTimers.get(card));
    }
    const t = setTimeout(() => {
      card.classList.remove(ACTION_SHOW_CLASS);
      hideTimers.delete(card);
      touchedCards.delete(card); // Reset touch state when auto-hiding
    }, HIDE_TIMEOUT);
    hideTimers.set(card, t);
  }

  function hideActionsFor(card) {
    if (!card) return;
    card.classList.remove(ACTION_SHOW_CLASS);
    if (hideTimers.has(card)) {
      clearTimeout(hideTimers.get(card));
      hideTimers.delete(card);
    }
    touchedCards.delete(card); // Reset touch state
  }

  // Track touch start position and time
  document.addEventListener('touchstart', (ev) => {
    touchStartX = ev.touches[0].clientX;
    touchStartY = ev.touches[0].clientY;
    touchStartTime = Date.now();
    isScrolling = false;
  }, { passive: true });

  // Detect if the user is scrolling
  document.addEventListener('touchmove', (ev) => {
    if (!isScrolling) {
      const touchX = ev.touches[0].clientX;
      const touchY = ev.touches[0].clientY;
      const diffX = Math.abs(touchX - touchStartX);
      const diffY = Math.abs(touchY - touchStartY);
      
      // If movement exceeds threshold, consider it a scroll
      if (diffX > TAP_THRESHOLD || diffY > TAP_THRESHOLD) {
        isScrolling = true;
      }
    }
  }, { passive: true });

  // Handle touch end events
  document.addEventListener('touchend', (ev) => {
    const touchX = ev.changedTouches[0].clientX;
    const touchY = ev.changedTouches[0].clientY;
    const diffX = Math.abs(touchX - touchStartX);
    const diffY = Math.abs(touchY - touchStartY);
    const touchDuration = Date.now() - touchStartTime;
    
    // Check if this was a tap (not a scroll)
    const isTap = !isScrolling && 
                 diffX <= TAP_THRESHOLD && 
                 diffY <= TAP_THRESHOLD && 
                 touchDuration <= TAP_TIME_THRESHOLD;
    
    if (!isTap) return;
    
    const t = ev.target;
    const card = findCard(t);
    if (!card) return;

    // Check if this is the first touch on this card
    const firstTouch = !touchedCards.has(card);
    
    // If it's the first touch, show actions and prevent navigation
    if (firstTouch) {
      touchedCards.set(card, true);
      ev.preventDefault();
      showActionsFor(card);
    }
    // If it's the second touch, let the event propagate (navigation will happen)
  }, { passive: false });

  // Only handle touch events for product links on touch devices
  if ('ontouchstart' in window) {
    document.addEventListener('click', (ev) => {
      const productLink = ev.target.closest('.product-link');
      if (!productLink) return;
      
      const card = findCard(productLink);
      if (!card) return;
      
      // If this is the first click on the card, prevent navigation
      if (touchedCards.has(card)) {
        // This is the second click, allow navigation
        touchedCards.delete(card); // Reset for next time
        return;
      } else {
        // This is the first click, prevent navigation
        ev.preventDefault();
        touchedCards.set(card, true);
        showActionsFor(card);
      }
    });
  }

  // Hide overlays when clicking/tapping outside product-cards
  document.addEventListener('click', (ev) => {
    // if clicked inside a product-card, do not hide that card
    const inCard = !!findCard(ev.target);
    if (inCard) return;

    // hide all shown cards
    document.querySelectorAll(`.product-card.${ACTION_SHOW_CLASS}`).forEach(c => {
      hideActionsFor(c);
    });
  });

  // Keyboard: reveal actions on focusin of product-link or action button
  document.addEventListener('focusin', (ev) => {
    const card = findCard(ev.target);
    if (card) showActionsFor(card);
  });

  // Hide on focusout if leaving card
  document.addEventListener('focusout', (ev) => {
    const card = findCard(ev.target);
    // small delay: if moving focus into the same card, don't hide
    setTimeout(() => {
      if (card && !card.contains(document.activeElement)) {
        hideActionsFor(card);
      }
    }, 10);
  });

  // Accessibility: allow Escape to hide any shown actions
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      document.querySelectorAll(`.product-card.${ACTION_SHOW_CLASS}`).forEach(c => hideActionsFor(c));
    }
  });

  // Expose helpers for debugging (optional)
  window.__productUI = {
    showActionsFor,
    hideActionsFor
  };
})(); 