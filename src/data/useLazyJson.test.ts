import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLazyJson } from "./useLazyJson";

describe("useLazyJson", () => {
  it("retries after a failed fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hello: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useLazyJson<{ hello: number }>("retry-test.json"),
    );
    await waitFor(() => expect(result.current.error).toMatch(/503/));
    act(() => result.current.retry?.());
    await waitFor(() => expect(result.current.data).toEqual({ hello: 1 }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
