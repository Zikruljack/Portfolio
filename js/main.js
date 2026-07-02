// ============================================
// UI/UX Pro Max — Portfolio Interactions
// ============================================

// --- Scroll Reveal (Intersection Observer) ---
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = parseInt(el.dataset.delay) || 0;
        el.style.transitionDelay = `${delay}ms`;
        el.classList.add('is-visible');
        revealObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach((el) => revealObserver.observe(el));

// --- Skill Cards staggered entrance ---
const skillCards = document.querySelectorAll('.skill-card');
skillCards.forEach((card, i) => {
  card.style.setProperty('--card-index', i);
});

// --- Navbar scroll effect (IntersectionObserver) ---
const navbar = document.getElementById('navbar');
const navSentinel = document.createElement('div');
navSentinel.style.position = 'absolute';
navSentinel.style.top = '60px';
navSentinel.style.left = '0';
navSentinel.style.width = '1px';
navSentinel.style.height = '1px';
document.body.prepend(navSentinel);

const navObserver = new IntersectionObserver(
  ([entry]) => {
    navbar.classList.toggle('bg-brand-900/80', !entry.isIntersecting);
    navbar.classList.toggle('shadow-lg', !entry.isIntersecting);
    navbar.classList.toggle('shadow-black/10', !entry.isIntersecting);
  },
  { threshold: 0 }
);
navObserver.observe(navSentinel);

// --- Smooth anchor scroll with offset ---
document.querySelectorAll('.nav-link, a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// --- prefers-reduced-motion: reveal all content immediately ---
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (prefersReducedMotion.matches) {
  document.querySelectorAll('.reveal').forEach((el) => {
    el.classList.add('is-visible');
    el.style.transitionDelay = '0ms';
  });
}
