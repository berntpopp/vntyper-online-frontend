// Ambient declarations for values this app receives from <script> tags in
// index.html rather than from ES module imports, plus the one remote module
// import. Without these, tsc reports errors for code that is correct at
// runtime.
//
// Keep these declarations honest: they describe only the surface the app
// actually uses, verified against the call sites. Widening them to `any` to
// silence an error defeats the purpose of the typecheck.

/**
 * Aioli runs samtools as WebAssembly in a WebWorker. Loaded from biowasm's CDN
 * with SRI; see index.html. Only the members the app calls are declared.
 */
declare class Aioli {
  constructor(tools: string | string[], options?: Record<string, unknown>);

  /**
   * Run a tool. The app always uses the (tool, args) form and interpolates the
   * result directly into log messages, so it is typed as the string output.
   */
  exec(tool: string, args?: string[]): Promise<string>;

  /** Mount File/Blob objects into the virtual filesystem; returns their paths. */
  mount(files: (File | Blob | Record<string, unknown>)[]): Promise<string[]>;

  fs: {
    stat(path: string): Promise<{ size: number }>;

    /**
     * Read a file out of the virtual filesystem. The bytes come back across the
     * WebWorker boundary as a copy backed by a plain ArrayBuffer, never a
     * SharedArrayBuffer - which is what lets the app hand the result straight to
     * `new Blob([...])`. The `Uint8Array<ArrayBuffer>` type argument records that;
     * a bare `Uint8Array` would widen the buffer to `ArrayBufferLike` and stop
     * being a valid BlobPart.
     */
    readFile(path: string, options?: { encoding?: string }): Promise<Uint8Array<ArrayBuffer>>;
    writeFile(path: string, data: Uint8Array | string): Promise<void>;
  };
}

/** intro.js, loaded from CDN for the guided tutorial. */
declare function introJs(element?: string | HTMLElement): IntroJsInstance;

interface IntroJsInstance {
  setOptions(options: Record<string, unknown>): IntroJsInstance;
  start(): IntroJsInstance;
  exit(): IntroJsInstance;
  onbeforechange(callback: (element: HTMLElement) => void): IntroJsInstance;
  oncomplete(callback: () => void): IntroJsInstance;
  onexit(callback: () => void): IntroJsInstance;
}

interface Window {
  /**
   * Set by resources/js/config.js, which is loaded ONLY by index.html. The
   * other four pages do not have it, so it is optional on purpose - read it
   * inside a function and guard it, never at module scope.
   */
  CONFIG?: {
    API_URL: string;
    API_DOCS_URL?: string;
    ENABLE_DONATIONS?: boolean;
    institutions: {
      name: string;
      logo: string;
      url: string;
      height: string;
      width: string;
      alt: string;
    }[];
  };

  /** Debugging handles parked by main.js. Not part of the application API. */
  __controllers?: Record<string, unknown>;
  __di?: unknown;
  __eventBus?: unknown;
}

/**
 * pako is dynamically imported from Skypack at runtime for BGZF inflation.
 * Only inflateRaw is used.
 */
declare module 'https://cdn.skypack.dev/pako@2.1.0' {
  export function inflateRaw(data: Uint8Array): Uint8Array;
}
