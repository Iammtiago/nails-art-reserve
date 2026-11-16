'use client';

import { forwardRef } from 'react';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  whatsapp: 'btn-whatsapp',
};
const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/**
 * <Button variant="primary|secondary|soft|ghost|danger|whatsapp" size="sm|md|lg" loading icon={Icon} block>
 * Renders an <a> when `href` is given.
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, block = false, className = '', children, href, type = 'button', disabled, ...props },
  ref,
) {
  const classes = ['btn', VARIANTS[variant] || VARIANTS.primary, SIZES[size] || '', block ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : Icon ? <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> : null}
      {children}
      {IconRight && !loading ? <IconRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> : null}
    </>
  );
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});

/** Square icon-only button; `label` is required for screen readers. */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className = '', ...props }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`btn ${VARIANTS[variant] || VARIANTS.ghost} ${dim} !min-h-0 !px-0 ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
