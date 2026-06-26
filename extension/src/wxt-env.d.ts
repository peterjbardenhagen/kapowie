/**
 * Type declarations for WXT virtual modules
 * These are auto-injected by WXT's Vite plugin at build time
 */

declare module 'wxt/sandbox' {
  export function defineBackground(handler: () => void): void;
  export function defineContentScript(definition: {
    matches: string[];
    main(): void;
  }): void;
  export function defineUnlistedScript(handler: () => void): void;
}

declare module 'wxt/browser' {
  export * from 'wxt/sandbox';
}
