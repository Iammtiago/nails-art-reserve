'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and tracks { data, error, loading }. `reload()` runs it again.
 * The loader receives an AbortSignal; stale responses are ignored.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const runId = useRef(0);

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++runId.current;
    const controller = new AbortController();
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current(controller.signal);
      if (id === runId.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (id === runId.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false }));
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Calls fn every `ms` while the tab is visible. */
export function useInterval(fn, ms, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}
