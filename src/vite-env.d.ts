/// <reference types="vite/client" />

// Vite asset modifier: import foo from "./image.png?inline";
// Returns a data URI string.
declare module '*?inline' {
  const src: string;
  export default src;
}
