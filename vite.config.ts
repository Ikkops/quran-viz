import { createReadStream, rmSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { DOWNLOADED_TAFSIR_PATHS } from "./src/data/editions";

/** Recitation audio lives in `audio/` (gitignored, filled by
 *  scripts/fetch_audio.py). It is served at `audio/` by `dev` and `preview`
 *  only — never copied into `dist/`, so it stays out of the Android APK. */
const AUDIO_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "audio");
const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".json": "application/json",
};

function audioMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    const at = path.indexOf("/audio/");
    if (at < 0) return next();
    const file = resolve(AUDIO_DIR, "." + path.slice(at + "/audio".length));
    const type = TYPES[extname(file)];
    if (!type || !file.startsWith(AUDIO_DIR + sep)) return next();
    let size: number;
    try {
      const st = statSync(file);
      if (!st.isFile()) return next();
      size = st.size;
    } catch {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("Content-Type", type);
    res.setHeader("Accept-Ranges", "bytes");
    // Ayah files never change; the index does as downloads progress.
    res.setHeader(
      "Cache-Control",
      type === "audio/mpeg" ? "public, max-age=604800" : "no-cache",
    );
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.setHeader("Content-Length", String(size));
    createReadStream(file).pipe(res);
  };
}

function localAudio(): Plugin {
  return {
    name: "quran-viz-local-audio",
    configureServer: (server) => void server.middlewares.use(audioMiddleware()),
    configurePreviewServer: (server) => void server.middlewares.use(audioMiddleware()),
  };
}

/** `vite build --mode android` (`npm run build:android`, the APK's build):
 *  leave out the tafsir editions the app downloads on request instead
 *  (`download` in src/data/editions.ts, fetched by src/data/tafsirStore.ts). */
function androidData(): Plugin {
  let outDir = "";
  return {
    name: "quran-viz-android-data",
    apply: (_, env) => env.command === "build" && env.mode === "android",
    configResolved: (c) => void (outDir = resolve(c.root, c.build.outDir)),
    closeBundle() {
      for (const p of DOWNLOADED_TAFSIR_PATHS)
        rmSync(resolve(outDir, "data", p), { recursive: true, force: true });
    },
  };
}

// Static SPA. Base is relative so it can be hosted from any subpath.
export default defineConfig({
  base: "./",
  plugins: [react(), localAudio(), androidData()],
});
