const memoryStorage = new Map<string, string>();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, String(value)),
      removeItem: (key: string) => memoryStorage.delete(key),
      clear: () => memoryStorage.clear(),
      key: (index: number) => [...memoryStorage.keys()][index] ?? null,
      get length() {
        return memoryStorage.size;
      },
    },
    configurable: true,
  });
}
