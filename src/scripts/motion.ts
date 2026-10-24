import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One Lenis instance for the whole visit: ClientRouter swaps pages without reloading this module
let lenis: Lenis | null = null;
if (!reducedMotion) {
  // anchors: in-page links (like the project tables of contents) glide instead of jumping, offset below the nav
  lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: { offset: -96 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function splitLines(el: HTMLElement) {
  // Headlines are authored with explicit <span class="line"> wrappers, so no text measuring is needed
  return el.querySelectorAll<HTMLElement>('.line > span');
}

function setupPage() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  if (reducedMotion) return;

  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    gsap.to(splitLines(el), {
      y: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.09,
      delay: Number(el.dataset.delay ?? 0.1),
    });
  });

  const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]');
  reveals
    .filter((el) => el.closest('[data-hero]'))
    .forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', delay: Number(el.dataset.delay ?? 0.35) },
      );
    });
  // Everything below the hero comes in in batches, so cards entering together cascade instead of popping at once
  gsap.set(
    reveals.filter((el) => !el.closest('[data-hero]')),
    { y: 18 },
  );
  ScrollTrigger.batch(
    reveals.filter((el) => !el.closest('[data-hero]')),
    {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12 }),
    },
  );

  ScrollTrigger.batch('[data-wipe]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { clipPath: 'inset(0% 0 0 0 round 0.75rem)', duration: 1.3, ease: 'expo.out', stagger: 0.12 }),
  });

  document.querySelectorAll<HTMLElement>('[data-rule]').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => el.classList.add('is-drawn') });
  });

  // The hero text drifts up and fades a little as you scroll away from it; the glow lags behind for depth
  const heroContent = document.querySelector<HTMLElement>('[data-hero-content]');
  if (heroContent) {
    const hero = heroContent.closest('[data-hero]')!;
    const scrub = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to(heroContent, { yPercent: -18, opacity: 0.25, ease: 'none', scrollTrigger: scrub });
    // the glow's own CSS drift uses transform, so the parallax goes through the separate translate property
    const glow = hero.querySelector<HTMLElement>('.glow');
    if (glow) ScrollTrigger.create({ ...scrub, onUpdate: (self) => (glow.style.translate = `0 ${self.progress * 25}%`) });
  }

  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: -6 },
      { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });

  ScrollTrigger.refresh();
}

// Mouse-only touches: the grid spotlight follows the cursor and the Download CV button leans towards it
const finePointer = window.matchMedia('(pointer: fine)').matches;

function setupPointer() {
  if (reducedMotion || !finePointer) return;

  document.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.classList.add('is-pointing');
    });
    el.addEventListener('pointerleave', () => el.classList.remove('is-pointing'));
  });

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'expo.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'expo.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.25);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      x(0);
      y(0);
    });
  });
}

// The nav slides away while you read down the page and comes back as soon as you scroll up
lenis?.on('scroll', ({ scroll, direction }: { scroll: number; direction: number }) => {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav || nav.contains(document.activeElement) || document.querySelector('#cv-download:popover-open')) return;
  nav.style.transform = direction === 1 && scroll > 160 ? 'translateY(-100%)' : '';
});

document.addEventListener('astro:page-load', () => {
  setupPage();
  setupPointer();
});
document.addEventListener('astro:after-swap', () => lenis?.scrollTo(0, { immediate: true }));
