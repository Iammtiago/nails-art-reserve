'use client';

import { useEffect } from 'react';

/**
 * One document listener gives every glass card a light that follows the cursor: it sets
 * --mx/--my on the card under the pointer, and the CSS (.glass::before) does the rest.
 * Only with a fine pointer; touch screens and «reduce motion» skip it.
 */
export function Spotlight() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduce.matches) return undefined;

    let frame = 0;
    let last = null;
    const onMove = (event) => {
      last = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const card = last?.target instanceof Element ? last.target.closest('.glass, .glass-deep') : null;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${last.clientX - rect.left}px`);
        card.style.setProperty('--my', `${last.clientY - rect.top}px`);
      });
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
