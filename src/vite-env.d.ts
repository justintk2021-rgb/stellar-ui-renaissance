/// <reference types="vite/client" />

declare module "*.svg?url" {
  const src: string;
  export default src;
}

// View Transitions API type declarations
interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
}

interface Document {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
}
