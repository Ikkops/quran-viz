// Where the synced copy lives: one secret gist in the learner's GitHub
// account, found by its description, holding one file. Every write is a new
// revision, so GitHub keeps the history. Only `fetch`, no SDK.

const API = "https://api.github.com";
export const GIST_FILE = "quran-viz-sync.json";
export const GIST_DESCRIPTION = "quran-viz sync";

export type SyncProblem = "token" | "offline" | "github" | "passphrase" | "format";

/** What went wrong, in a form the settings card can explain. */
export class SyncError extends Error {
  constructor(
    readonly problem: SyncProblem,
    detail: string = problem,
  ) {
    super(detail);
  }
}

async function call(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new SyncError("offline");
  }
  // 401: unknown or expired token; 403: no Gists permission (or rate limit).
  if (res.status === 401 || res.status === 403) throw new SyncError("token");
  if (!res.ok && res.status !== 404)
    throw new SyncError("github", `GitHub ${res.status}`);
  return res;
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  description: string | null;
  files: Record<string, GistFile | undefined>;
}

/** The id of the learner's sync gist, or null when there is none yet. */
export async function findGist(token: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const res = await call(token, `/gists?per_page=100&page=${page}`);
    if (!res.ok) return null;
    const gists = (await res.json()) as Gist[];
    const mine = gists.find(
      (g) => g.description === GIST_DESCRIPTION && g.files[GIST_FILE],
    );
    if (mine) return mine.id;
    if (gists.length < 100) return null;
  }
  return null;
}

/** The file's text, or null when the gist or the file is gone. */
export async function readGist(token: string, id: string): Promise<string | null> {
  const res = await call(token, `/gists/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  const file = ((await res.json()) as Gist).files[GIST_FILE];
  if (!file) return null;
  // Large files come truncated in the listing; the raw copy is whole.
  if (file.truncated && file.raw_url) {
    try {
      const raw = await fetch(file.raw_url);
      if (!raw.ok) throw new SyncError("github", `GitHub ${raw.status}`);
      return await raw.text();
    } catch (e) {
      throw e instanceof SyncError ? e : new SyncError("offline");
    }
  }
  return file.content ?? null;
}

export async function createGist(token: string, content: string): Promise<string> {
  const res = await call(token, "/gists", {
    method: "POST",
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILE]: { content } },
    }),
  });
  if (!res.ok) throw new SyncError("token");
  return ((await res.json()) as Gist).id;
}

export async function writeGist(
  token: string,
  id: string,
  content: string,
): Promise<void> {
  const res = await call(token, `/gists/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
  });
  if (!res.ok) throw new SyncError("github", `GitHub ${res.status}`);
}
