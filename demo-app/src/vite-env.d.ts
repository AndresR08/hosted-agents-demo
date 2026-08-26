/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BROKER_BASE_URL: string;
  readonly VITE_DEFAULT_MODE: "live" | "replay";
  readonly VITE_REGION: string;
  readonly VITE_RESOURCE_GROUP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
