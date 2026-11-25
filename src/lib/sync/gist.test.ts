import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GIST_DESCRIPTION, GIST_FILE, SyncError, findGist, readGist } from "./gist";
import { gistTransport, readConfig, saveConfig } from "./engine";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("the sync gist", () => {
  it("is found by its description and file, with the token sent", async () => {
    fetchMock.mockResolvedValueOnce(
      json([
        { id: "other", description: "notes", files: { "a.md": {} } },
        { id: "g1", description: GIST_DESCRIPTION, files: { [GIST_FILE]: {} } },
      ]),
    );
    expect(await findGist("tok")).toBe("g1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/gists?per_page=100&page=1");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("reads a large file from its raw copy", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          id: "g1",
          files: { [GIST_FILE]: { truncated: true, raw_url: "https://raw/x" } },
        }),
      )
      .mockResolvedValueOnce(new Response("whole"));
    expect(await readGist("tok", "g1")).toBe("whole");
    expect(fetchMock.mock.calls[1][0]).toBe("https://raw/x");
  });

  it("names the problem: a refused token, no connection", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "Bad credentials" }, 401));
    await expect(findGist("tok")).rejects.toMatchObject({ problem: "token" });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const e = await readGist("tok", "g1").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SyncError);
    expect((e as SyncError).problem).toBe("offline");
  });

  it("is created on the first write when there is none, and remembered", async () => {
    saveConfig({ token: "tok", passphrase: "pw" });
    fetchMock
      .mockResolvedValueOnce(json([])) // no gist yet
      .mockResolvedValueOnce(json({ id: "new1", files: {} })); // created
    const t = gistTransport(readConfig()!);
    expect(await t.read()).toBeNull();
    await t.write("sealed");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/gists");
    expect(JSON.parse(init.body as string)).toMatchObject({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILE]: { content: "sealed" } },
    });
    expect(readConfig()?.gistId).toBe("new1");
  });
});
