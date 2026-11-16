'use client';

import { Keyboard, ShieldCheck } from 'lucide-react';
import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BOOKING_CODE_LENGTH, extractBookingCode, sanitizeCodeInput } from './bookingCode';

const SLOTS = Array.from({ length: BOOKING_CODE_LENGTH }, (_, i) => i);
const DEFAULT_HINT = 'Está debajo del QR, en el ticket de la clienta.';

function hintFor({ missing, ambiguous }) {
  if (missing > 0) {
    return { text: missing === 1 ? 'Falta 1 carácter.' : `Faltan ${missing} caracteres.`, className: 'font-medium text-danger' };
  }
  if (ambiguous) return { text: 'Los códigos no usan 0, O, 1, I ni L.', className: 'font-medium text-warning' };
  return { text: DEFAULT_HINT, className: 'text-ink-3' };
}

function CodeBox({ char, active, busy }) {
  let tone = 'border-line bg-surface/80 text-ink-3';
  if (active) tone = 'border-accent bg-surface text-primary-ink shadow-focus';
  else if (char) tone = 'border-secondary bg-secondary-soft text-primary-ink';
  return (
    <div className={`grid h-14 min-w-0 place-items-center rounded-xl border-2 font-mono text-2xl font-semibold transition sm:h-16 ${tone} ${busy ? 'opacity-70' : ''}`}>
      {char || (active ? <span className="h-7 w-0.5 animate-pulse rounded-full bg-accent" /> : null)}
    </div>
  );
}

/**
 * One real <input> drawn as 6 boxes. Controlled: value is the clean code.
 * Calls onSubmit(code) when it reaches 6 characters or on «Verificar código».
 * Ref: { focus(options) }
 */
export const CodeInput = forwardRef(function CodeInput({ value, onChange, onSubmit, busy = false, style }, ref) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [missing, setMissing] = useState(0);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  useImperativeHandle(ref, () => ({ focus: (options) => inputRef.current?.focus(options) }), []);

  const apply = (next, isAmbiguous) => {
    setAmbiguous(isAmbiguous);
    setMissing(0);
    const completed = next.length === BOOKING_CODE_LENGTH && next !== value;
    onChange(next);
    if (completed) onSubmit(next);
  };

  const keepCaretAtEnd = (event) => {
    const input = event.currentTarget;
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
  };

  const handleChange = (event) => {
    const { code, ambiguous: flagged } = sanitizeCodeInput(event.target.value);
    apply(code, flagged);
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text') || '';
    event.preventDefault();
    const extracted = extractBookingCode(text);
    if (extracted) {
      apply(extracted, false);
      return;
    }
    const { code, ambiguous: flagged } = sanitizeCodeInput(`${value}${text}`);
    apply(code, flagged);
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (value.length < BOOKING_CODE_LENGTH) {
      setMissing(BOOKING_CODE_LENGTH - value.length);
      inputRef.current?.focus();
      return;
    }
    onSubmit(value);
  };

  const hint = hintFor({ missing, ambiguous });
  const activeIndex = Math.min(value.length, BOOKING_CODE_LENGTH - 1);

  return (
    <section className="glass enter p-4 sm:p-5" aria-labelledby={`${inputId}-title`} style={style}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
          <Keyboard aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id={`${inputId}-title`} className="font-display text-lg font-semibold leading-tight">
            Escribiendo el código
          </h2>
          <p className="text-sm text-ink-2">Si la cámara no lee el QR.</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor={inputId} className="field-label">
            Código de 6 caracteres
          </label>
          <div className="relative">
            <div className="grid grid-cols-6 gap-1.5 min-[400px]:gap-2" aria-hidden="true">
              {SLOTS.map((index) => (
                <CodeBox key={index} char={value[index] || ''} active={focused && index === activeIndex} busy={busy} />
              ))}
            </div>
            <input
              ref={inputRef}
              id={inputId}
              name="codigo"
              type="text"
              inputMode="text"
              value={value}
              onChange={handleChange}
              onPaste={handlePaste}
              onFocus={(event) => {
                setFocused(true);
                keepCaretAtEnd(event);
              }}
              onBlur={() => setFocused(false)}
              onClick={keepCaretAtEnd}
              onKeyUp={keepCaretAtEnd}
              maxLength={BOOKING_CODE_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-describedby={hintId}
              aria-invalid={missing > 0 || undefined}
              className="absolute inset-0 h-full w-full cursor-text rounded-xl border-0 bg-transparent font-mono text-base text-transparent caret-transparent outline-none selection:bg-transparent focus:outline-none focus-visible:outline-none"
            />
          </div>
          <p id={hintId} className={`mt-2 text-[0.8rem] ${hint.className}`} aria-live="polite">
            {hint.text}
          </p>
        </div>
        <Button type="submit" variant="soft" icon={ShieldCheck} block loading={busy}>
          Verificar código
        </Button>
      </form>
    </section>
  );
});
