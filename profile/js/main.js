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

// --- Navbar scroll effect ---
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  if (currentScroll > 60) {
    navbar.classList.add('bg-brand-900/80', 'shadow-lg', 'shadow-black/10');
  } else {
    navbar.classList.remove('bg-brand-900/80', 'shadow-lg', 'shadow-black/10');
  }
  lastScroll = currentScroll;
});

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

// --- Cursor pointer on all clickables (UX rule) ---
document.querySelectorAll('a, button, [role="button"]').forEach((el) => {
  el.style.cursor = 'pointer';
});

// --- prefers-reduced-motion: disable all animations ---
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (prefersReducedMotion.matches) {
  document.querySelectorAll('.reveal').forEach((el) => {
    el.classList.add('is-visible');
    el.style.transitionDelay = '0ms';
  });
}
