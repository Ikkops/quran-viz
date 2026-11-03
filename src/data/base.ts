/** Vite base URL. All static JSON fetches are prefixed with this so the app
 *  works from any host subpath (Vite `base: "./"`). Import this instead of
 *  re-reading `import.meta.env.BASE_URL` in every data module. */
export const BASE = import.meta.env.BASE_URL;

/** Resolve a data-file path to its full URL. */
export function dataUrl(path: string): string {
  return `${BASE}data/${path}`;
}
