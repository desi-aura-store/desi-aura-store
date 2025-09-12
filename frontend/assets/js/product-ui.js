// frontend/assets/js/product-ui.js
// Single shared UI for product cards: hover reveal, touch reveal, add/buy handlers.

(function () {
  if (window.__product_ui_installed) return;
  window.__product_ui_installed = true;

  const ACTION_SHOW_CLASS = 'show-actions';
  const HIDE_TIMEOUT = 3500; // ms to auto-hide on mobile

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
  }

  // Use touchstart to intercept first tap on touch devices.
  // passive:false so we can call preventDefault when needed.
  document.addEventListener('touchstart', (ev) => {
    const t = ev.target;
    const card = findCard(t);
    if (!card) return;

    // if action buttons already visible and user tapped a product-link inside, allow navigation
    const link = t.closest && t.closest('.product-link');
    if (!card.classList.contains(ACTION_SHOW_CLASS)) {
      // show actions and prevent immediate navigation (first tap)
      ev.preventDefault();
      showActionsFor(card);
    } else {
      // already visible: do nothing special (let clicks proceed)
      // if tap was outside card content we still want to leave it visible until next click-outside
    }
  }, { passive: false });

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
