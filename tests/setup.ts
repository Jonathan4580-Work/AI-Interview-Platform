Object.assign(process.env, {
  NODE_ENV: "test",
  APP_ENV: "test",
  APP_NAME: "Aptly Test",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://aptly:aptly@localhost:5432/aptly_test?schema=public",
  DIRECT_DATABASE_URL: "postgresql://aptly:aptly@localhost:5432/aptly_test?schema=public",
  REDIS_URL: "redis://localhost:6379/1",
  REQUEST_ID_HEADER: "x-request-id",
  CORRELATION_ID_HEADER: "x-correlation-id",
  SMTP_SECRET_REF: "test/smtp",
  OBJECT_STORAGE_SECRET_REF: "test/object-storage",
});

import "@testing-library/jest-dom/vitest";

class TestResizeObserver {
  observe(): void {
    return undefined;
  }
  unobserve(): void {
    return undefined;
  }
  disconnect(): void {
    return undefined;
  }
}

function createTestStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

Object.assign(globalThis, {
  ResizeObserver: TestResizeObserver,
  matchMedia: () => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: createTestStorage(),
});
