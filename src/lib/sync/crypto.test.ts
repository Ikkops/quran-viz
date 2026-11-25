import { describe, expect, it } from "vitest";
import { fromBase64, isSealed, seal, toBase64, unseal, WrongPassphrase } from "./crypto";

describe("sealing the synced copy", () => {
  it("opens with the passphrase and not without it", async () => {
    const sealed = await seal('{"secret":"Al-Kahf"}', "pass phrase", { iter: 1000 });
    expect(isSealed(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain("Al-Kahf");
    const { plain, salt } = await unseal(sealed, "pass phrase");
    expect(plain).toBe('{"secret":"Al-Kahf"}');
    await expect(unseal(sealed, "wrong")).rejects.toBeInstanceOf(WrongPassphrase);
    // Re-sealed with the same salt: a fresh IV, still opens.
    const again = await seal("x", "pass phrase", { salt, iter: 1000 });
    expect(again.salt).toBe(sealed.salt);
    expect(again.iv).not.toBe(sealed.iv);
    expect((await unseal(again, "pass phrase")).plain).toBe("x");
  });

  it("round-trips large data through base64", () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
