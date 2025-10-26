// Global type declarations for the Delphi app

// Allow importing .txt files as assets
declare module "*.txt" {
  const content: number;
  export default content;
}
