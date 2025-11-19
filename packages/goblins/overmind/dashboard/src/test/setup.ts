import "@testing-library/jest-dom";
import { vi } from "vitest";

// Only setup browser mocks when in jsdom environment
if (typeof window !== 'undefined') {
  // Mock Tauri API
  (globalThis as any).__TAURI__ = {
    invoke: vi.fn(),
    dialog: {
      open: vi.fn(),
    },
    fs: {
      readTextFile: vi.fn(),
      writeTextFile: vi.fn(),
    },
    path: {
      appDataDir: vi.fn(),
    },
  };

  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}
