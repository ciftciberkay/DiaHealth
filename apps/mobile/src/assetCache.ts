export const createAssetCache = <T>(load: (source: number) => Promise<T>) => {
  const images = new Map<number, T>();
  const pending = new Map<number, Promise<T>>();

  const loadOnce = (source: number): Promise<T> => {
    if (images.has(source)) {
      return Promise.resolve(images.get(source)!);
    }

    const existing = pending.get(source);
    if (existing) {
      return existing;
    }

    const task = Promise.resolve()
      .then(() => load(source))
      .then((image) => {
        images.set(source, image);
        return image;
      })
      .finally(() => pending.delete(source));

    pending.set(source, task);
    return task;
  };

  return {
    get: (source: number): T | number => images.get(source) ?? source,
    preload: (sources: readonly number[]) => Promise.allSettled([...new Set(sources)].map(loadOnce))
  };
};
