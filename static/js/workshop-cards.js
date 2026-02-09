// Workshop Cards Scroll Animation + Navigation
(function() {
  const cards = document.querySelectorAll('.workshop-card');

  if (cards.length === 0) return;

  // === Card scroll-in animation (existing behavior) ===
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        cardObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  cards.forEach(card => {
    cardObserver.observe(card);
  });

  // === Card click → update URL anchor ===
  cards.forEach(card => {
    if (card.id) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('a')) return;
        history.replaceState(null, '', '#' + this.id);
      });
    }
  });

  // === Pill Navigation ===
  const nav = document.querySelector('.workshop-nav');
  const pills = document.querySelectorAll('.workshop-nav-pill');

  if (!nav || pills.length === 0) return;

  // --- Smooth scroll on pill click ---
  pills.forEach(pill => {
    pill.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('data-target');
      const targetCard = document.getElementById(targetId);
      if (targetCard) {
        targetCard.classList.add('visible');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + targetId);
      }
    });
  });

  // --- Sticky detection via sentinel ---
  const sentinel = document.getElementById('workshop-nav-sentinel');
  if (sentinel) {
    const stickyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        nav.classList.toggle('is-sticky', !entry.isIntersecting);
      });
    }, {
      threshold: 0
    });
    stickyObserver.observe(sentinel);
  }

  // --- Active pill tracking ---
  const cardIds = Array.from(cards).map(card => card.id).filter(Boolean);

  if (cardIds.length > 0) {
    const activePillObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pill = nav.querySelector('[data-target="' + entry.target.id + '"]');
        if (pill) {
          pill.classList.toggle('active', entry.isIntersecting);
        }
      });
    }, {
      threshold: 0.3,
      rootMargin: '-80px 0px -40% 0px'
    });

    cards.forEach(card => {
      if (card.id) {
        activePillObserver.observe(card);
      }
    });
  }

  // === Handle anchor navigation (from homepage links) ===
  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    const targetCard = document.getElementById(targetId);
    if (targetCard) {
      targetCard.classList.add('visible');
      requestAnimationFrame(() => {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }
})();
