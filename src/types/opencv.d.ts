// OpenCV.js has no official, complete TypeScript types for the WASM build.
// We treat `cv` as `any` and rely on the runtime + our processor code for safety.
declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

// `Cv` is the loose type we pass around for the OpenCV namespace object.
export type Cv = any;

export {};
