import {useCallback, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {registerRestorer, rememberReturnRow, takeReturnRow} from '../state/returnFocus';
import {focusHandle} from './focus';

/** The Lists tab's rows. */
export const LISTS_SCOPE = 'lists';

/**
 * The rows of a screen by key: `go` opens another route from a row, and the
 * way back lands on that row again even when the rows changed meanwhile.
 */
export function useRows(scope: string, path: string) {
  const rows = useRef(new Map<string, unknown>());
  const navigate = useNavigate();

  useEffect(
    () =>
      registerRestorer(() => {
        if (window.location.pathname !== path) return;
        const row = takeReturnRow(scope);
        if (row) {
          requestAnimationFrame(() => requestAnimationFrame(() => focusHandle(rows.current.get(row))));
        }
      }),
    [path, scope],
  );

  const rowRef = useCallback(
    (key: string) => (handle: unknown) => {
      if (handle == null) rows.current.delete(key);
      else rows.current.set(key, handle);
    },
    [],
  );
  const go = useCallback(
    (row: string, to: string) => {
      rememberReturnRow(scope, row);
      navigate(to);
    },
    [navigate, scope],
  );
  const moveTo = useCallback((key: string) => focusHandle(rows.current.get(key)), []);
  return {rowRef, go, moveTo};
}
