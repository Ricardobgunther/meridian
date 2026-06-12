'use client';

import { useEffect, useState } from 'react';

/**
 * Retorna o valor "assentado" `delayMs` após a última mudança.
 *
 * Primeiro debounce reutilizável do codebase (spec dashboard-and-leave-org
 * 05 §8) — a busca do MembersToolbar pode adotá-lo depois.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
