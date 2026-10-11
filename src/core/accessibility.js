(() => {
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  let modalTrigger = null;

  function prepareNavigation() {
    const menuButton = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuButton && sidebar) {
      menuButton.setAttribute('aria-controls', 'sidebar');
      menuButton.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.classList.contains('active')) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function prepareTables(root = document) {
    root.querySelectorAll('.data-table').forEach(table => {
      table.dataset.mobileCards = 'true';
      const headings = [...table.querySelectorAll('thead th')].map(cell => cell.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (!cell.hasAttribute('colspan')) cell.dataset.label = headings[index] || '';
        });
      });
    });
  }

  function prepareModal(modal) {
    if (modal.dataset.accessibilityReady) return;
    modal.dataset.accessibilityReady = 'true';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const title = modal.querySelector('.modal-head h2');
    if (title) {
      if (!title.id) title.id = `dialog-title-${Date.now()}`;
      modal.setAttribute('aria-labelledby', title.id);
    }
    const controls = [...modal.querySelectorAll(focusableSelector)];
    (controls[0] || modal).focus();

    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        modal.querySelector('[data-action="close-modal"], #closeLoginModalBtn')?.click();
        return;
      }
      if (event.key !== 'Tab') return;
      const currentControls = [...modal.querySelectorAll(focusableSelector)];
      if (!currentControls.length) return;
      const first = currentControls[0];
      const last = currentControls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function observeInterface() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          prepareTables(node);
          const modal = node.matches('.modal') ? node : node.querySelector('.modal');
          if (modal) prepareModal(modal);
        });
      }
      prepareNavigation();
      if (!document.querySelector('.modal') && modalTrigger?.isConnected) {
        modalTrigger.focus();
        modalTrigger = null;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('click', event => {
    const modalOpener = event.target.closest('[data-action^="new-"], [data-action^="payment:"], #openLoginModalBtn');
    if (modalOpener) modalTrigger = modalOpener;
    queueMicrotask(prepareNavigation);
  });

  function init() {
    const mainContent = document.getElementById('appContent');
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1');
      mainContent.setAttribute('aria-label', 'Conteúdo principal');
    }
    prepareNavigation();
    prepareTables();
    observeInterface();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
