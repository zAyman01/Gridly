import { useEffect, type RefObject } from "react";

/** Elements marked this way start hidden and settle in when they scroll up. */
const REVEAL_SELECTOR = "[data-reveal], [data-reveal-group] > *, [data-count], [data-bar], [data-draw]";

function countUp(el: HTMLElement, target: number) {
  const slot = el.firstElementChild ?? el;
  const started = Date.now();
  const duration = 900;
  // Timers, not rAF: the number still lands if the tab never paints.
  const id = window.setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    slot.textContent = String(Math.round(target * eased));
    if (t >= 1) window.clearInterval(id);
  }, 40);
  return id;
}

/**
 * Reveals content on scroll with CSS transitions. Nothing is hidden until this
 * runs, so a failed script or a reduced-motion preference leaves the page whole.
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const host = root.current;
    if (!host || !enabled) return;

    const timers: number[] = [];
    const targets = Array.from(host.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

    // Children of a group cascade, one after another.
    host.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        (child as HTMLElement).style.setProperty("--reveal-delay", `${i * 70}ms`);
      });
    });

    const pending = new Set(targets);

    // Figures are rendered at their final value so a reduced-motion or
    // script-free reader sees the real number; only an animated run zeroes them.
    host.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const slot = el.firstElementChild ?? el;
      slot.textContent = "0";
    });

    function reveal(el: HTMLElement) {
      if (!pending.delete(el)) return;
      el.classList.add("is-in");
      if (el.dataset.count) timers.push(countUp(el, Number(el.dataset.count)));
      observer.unobserve(el);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    targets.forEach((el) => observer.observe(el));

    // Safety net: where the observer never reports — a background tab that is
    // not painting, say — a plain timer still lets content through.
    const sweep = window.setInterval(() => {
      if (pending.size === 0) {
        window.clearInterval(sweep);
        return;
      }
      const limit = window.innerHeight * 0.92;
      for (const el of Array.from(pending)) {
        if (el.getBoundingClientRect().top < limit) reveal(el);
      }
    }, 300);

    return () => {
      observer.disconnect();
      window.clearInterval(sweep);
      timers.forEach((id) => window.clearInterval(id));
    };
  }, [root, enabled]);
}
