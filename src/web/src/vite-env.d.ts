/// <reference types="vite/client" />

// Environment variable type definitions
interface ImportMetaEnv {
  /**
   * Base URL for API endpoints
   */
  readonly VITE_API_BASE_URL: string;

  /**
   * Base URL for WebSocket connections
   */
  readonly VITE_WS_BASE_URL: string;
}

/**
 * Type augmentation for Vite's import.meta object
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Static asset module declarations
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.woff2" {
  const content: string;
  export default content;
}