import { mkdir, copyFile, rm } from "node:fs/promises";

const outDir = new URL("../dist/", import.meta.url);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyFile(new URL("../index.html", import.meta.url), new URL("index.html", outDir));
await copyFile(new URL("../main.js", import.meta.url), new URL("main.js", outDir));
console.log("Build complete: dist/index.html and dist/main.js");
