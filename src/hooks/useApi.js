import { useCallback, useEffect, useRef, useState } from 'react';

/* Loading, error and data in one place, so every screen gets all three states
   for free and none of them can be forgotten. CLAUDE.md 2, rule 7.

   `deps` behaves like a useEffect dependency array. The request is aborted if
   the deps change or the component unmounts before it lands, so a fast filter
   change cannot leave a stale response overwriting a newer one. */
export function useApi(fetcher, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [reloadKey, setReloadKey] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    Promise.resolve(fetcherRef.current({ signal: controller.signal }))
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return;
        setError(err);
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skip, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, error, loading, reload };
}

/* For writes. Nothing fires on render; the caller invokes run() and awaits
   the result, so a form can act on success without a second effect. */
export function useMutation(mutator) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const mutatorRef = useRef(mutator);
  mutatorRef.current = mutator;

  const run = useCallback(async (...args) => {
    setPending(true);
    setError(null);
    try {
      return await mutatorRef.current(...args);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
