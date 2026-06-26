declare module '*.svelte' {
  import { SvelteComponent } from 'svelte';

  export default class Component extends SvelteComponent {}
}

declare module '*.svg' {
  const src: string;
  export default src;
}
