'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

// Stack of open modals: only the top one reacts to Escape, and page scroll is
// restored only when the last one closes.
const stack = [];

// iOS Safari ignores `overflow: hidden` on <body>: the page kept scrolling under the sheet and
// jumped when it closed. Pinning the body with position: fixed (and restoring the exact scroll
// instantly, not with the global smooth scroll) works on every browser.
let savedScrollY = 0;

function lockScroll() {
  if (stack.length !== 1) return;
  const body = document.body;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  savedScrollY = window.scrollY;
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  document.documentElement.dataset.modalOpen = 'true';
}

function unlockScroll() {
  if (stack.length !== 0) return;
  const body = document.body;
  for (const prop of ['position', 'top', 'left', 'right', 'width', 'overflow', 'paddingRight']) body.style[prop] = '';
  delete document.documentElement.dataset.modalOpen;
  window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet on mobile, centered panel on desktop.
 * placement="top" drops it from the top on mobile instead (short forms that open the keyboard).
 * <Modal open onClose title description size="sm|md|lg" placement="bottom|top" footer={...}>…</Modal>
 */
export function Modal({ open, onClose, title, description, size = 'md', placement = 'bottom', footer, children, initialFocusRef }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const token = Symbol('modal');
    stack.push(token);
    lockScroll();
    const previouslyFocused = document.activeElement;

    // Focus the first field once it exists (content may render after the panel).
    let observer = null;
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return false;
      const target =
        initialFocusRef?.current || panel.querySelector('[data-autofocus]') || panel.querySelector('input,select,textarea') || panel.querySelector(FOCUSABLE);
      if (target) {
        target.focus({ preventScroll: true });
        return true;
      }
      return false;
    };
    if (!focusFirst() && panelRef.current) {
      observer = new MutationObserver(() => {
        if (focusFirst()) observer.disconnect();
      });
      observer.observe(panelRef.current, { childList: true, subtree: true });
    }

    const onKey = (event) => {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
      }
      if (event.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      observer?.disconnect();
      document.removeEventListener('keydown', onKey);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
      unlockScroll();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  const top = placement === 'top';

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center sm:items-center sm:p-6 ${
        top ? 'items-start px-3 pt-[max(4.75rem,calc(env(safe-area-inset-top)+4.25rem))]' : 'items-end'
      }`}
    >
      <div className="absolute inset-0 bg-[rgb(var(--color-text-rgb)/0.5)] sm:backdrop-blur-[2px]" onClick={() => onCloseRef.current?.()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={`glass glass-strong relative flex w-full flex-col overflow-hidden sm:max-h-[92dvh] sm:rounded-3xl ${
          top ? 'max-h-[calc(100dvh-6rem)] rounded-3xl animate-fade-up' : 'max-h-[92dvh] rounded-b-none rounded-t-3xl animate-sheet-up'
        } ${widths[size] || widths.md}`}
      >
        {!top ? <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" /> : null}
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="font-display text-xl font-semibold leading-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descId} className="mt-1 text-sm text-ink-2">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={() => onCloseRef.current?.()} className="btn btn-ghost -mr-2 -mt-1 h-11 w-11 !min-h-0 !px-0" aria-label="Cerrar">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
        {footer ? <div className="border-t border-line/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
