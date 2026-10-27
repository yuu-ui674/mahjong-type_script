import { readFile, writeFile, unlink } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const htmlUrl = new URL("index.html", dist);
const jsUrl = new URL("main.js", dist);
const standaloneUrl = new URL("mahjong-standalone.html", dist);
const rootStandaloneUrl = new URL("../mahjong-standalone.html", import.meta.url);

const [html, js] = await Promise.all([
  readFile(htmlUrl, "utf8"),
  readFile(jsUrl, "utf8")
]);

const scriptTag = '<script src="./main.js"></script>';
const occurrences = html.split(scriptTag).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly one ${scriptTag}, found ${occurrences}`);
}
if (/<\/script/i.test(js)) {
  throw new Error("Generated JavaScript contains a closing script tag and cannot be safely inlined.");
}

const inlineTag = `<script>\n${js}\n</script>`;
const standalone = html.replace(scriptTag, inlineTag);

// Cloudflare Pages serves this self-contained page at the site root.
await writeFile(htmlUrl, standalone, "utf8");
// Also publish an explicitly named copy for easy download/use outside Pages.
await writeFile(standaloneUrl, standalone, "utf8");
await writeFile(rootStandaloneUrl, standalone, "utf8");
// main.js remains at the project root for development, but isn't needed in dist.
await unlink(jsUrl);

console.log("Build complete: dist/index.html, dist/mahjong-standalone.html and project-root mahjong-standalone.html (self-contained HTML)");
