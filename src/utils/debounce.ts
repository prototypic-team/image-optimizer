export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  config?: { threshold?: number; throttle?: boolean }
) => {
  let lastArgs: Parameters<F>,
    timeout: NodeJS.Timeout | undefined,
    lastResult: ReturnType<F>;
  const f = (...args: Parameters<F>): ReturnType<F> => {
    // @ts-expect-error
    lastArgs = [...args];

    if (config?.throttle && timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = undefined;
        lastResult = func(...lastArgs);
      }, config?.threshold ?? 50);
    }

    return lastResult;
  };

  return f;
};
