import {useCallback, useEffect, useRef, useState} from 'react';
import {demoBySession, getConfigSource, parseConfig, sameConfig, type ConfigState, type ConfigValues} from '../config/lumenConfig';

/**
 * Reads the TickTick token from `window.lumen.config` (or the development
 * fallback) and follows changes made on the phone while the app is open.
 */
export function useLumenConfig(): [ConfigState, () => Promise<ConfigState>] {
  const [config, setConfig] = useState<ConfigState>({status: 'loading'});
  const reloadRef = useRef<() => Promise<ConfigState>>(() => Promise.resolve(config));

  useEffect(() => {
    const source = getConfigSource();
    const demo = demoBySession();
    let alive = true;
    const apply = (values: ConfigValues): ConfigState => {
      const next = parseConfig(values, demo);
      if (alive) {
        setConfig(previous => (sameConfig(previous, next) ? previous : next));
      }
      return next;
    };
    const read = () => source.get().then(apply, () => apply({}));
    reloadRef.current = read;
    void read();
    const unsubscribe = source.subscribe(values => (values ? apply(values) : void read()));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(() => reloadRef.current(), []);
  return [config, reload];
}
