/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY?: string;
    VITE_GEMINI_API_KEY?: string;
    DISABLE_HMR?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
