/** Diffère un callback hors du corps synchrone d'un useEffect (React Compiler). */
export function deferEffect(callback: () => void | Promise<void>): void {
  queueMicrotask(() => {
    void callback();
  });
}
