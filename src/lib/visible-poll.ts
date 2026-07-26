/**
 * Sekme görünürken interval çalıştır; gizliyken durdur.
 * Panel poll'larını CPU/SQLite yükünden korur.
 */
export function startVisibleInterval(
  fn: () => void,
  ms: number,
  options?: { runImmediately?: boolean },
) {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    stop();
    if (document.visibilityState !== "visible") return;
    timer = setInterval(() => {
      if (document.visibilityState === "visible") fn();
    }, ms);
  };

  const onVis = () => {
    if (document.visibilityState === "visible") {
      fn();
      start();
    } else {
      stop();
    }
  };

  if (options?.runImmediately !== false && document.visibilityState === "visible") {
    fn();
  }
  start();
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVis);
  };
}
