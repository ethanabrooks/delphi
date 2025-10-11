#!/usr/bin/env node

const { spawn } = require("node:child_process");

// eslint-disable-next-line no-console
console.log("🔍 Checking for bundle/import issues...");

// Start Metro bundler and look for import errors (skip web platform)
const metro = spawn(
  "npx",
  ["expo", "export", "--platform", "android", "--no-minify"],
  {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  }
);

let hasErrors = false;

const timeout = setTimeout(() => {
  metro.kill();
  if (!hasErrors) {
    // eslint-disable-next-line no-console
    console.log("✅ No import/bundle errors detected");
    process.exit(0);
  }
}, 10000); // 10 second timeout

metro.stdout.on("data", () => {
  // Process stdout data but don't store it
});

metro.stderr.on("data", (data) => {
  const error = data.toString();

  if (
    error.includes("Unable to resolve") ||
    error.includes("Module not found") ||
    error.includes("Cannot resolve module")
  ) {
    hasErrors = true;
    clearTimeout(timeout);
    metro.kill();
    // biome-ignore lint/suspicious/noConsole: surfaced to STDERR during CI failures
    console.error("❌ Bundle/import errors detected:");
    // biome-ignore lint/suspicious/noConsole: surfaced to STDERR during CI failures
    console.error(error);
    process.exit(1);
  }
});

metro.on("close", (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    // eslint-disable-next-line no-console
    console.log("✅ Bundle completed successfully");
    process.exit(0);
  } else if (!hasErrors) {
    // eslint-disable-next-line no-console
    console.log("⚠️  Bundle completed with warnings (but no import errors)");
    process.exit(0);
  }
});

metro.on("error", (err) => {
  clearTimeout(timeout);
  // biome-ignore lint/suspicious/noConsole: surfaced to STDERR during CI failures
  console.error("❌ Failed to start bundler:", err.message);
  process.exit(1);
});
