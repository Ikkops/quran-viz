// The synced copy is encrypted on the device before it leaves: a key derived
// from the learner's passphrase (PBKDF2-SHA256) seals it with AES-GCM, so the
// gist holds nothing readable. WebCrypto does the work.

export const KDF_ITERATIONS = 600_000;

export interface Sealed {
  app: "quran-viz";
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

/** The passphrase does not open the copy (or the copy was changed). */
export class WrongPassphrase extends Error {}

const text = new TextEncoder();

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  // In slices: spreading a large array into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const isSealed = (x: unknown): x is Sealed => {
  const s = x as Partial<Sealed> | null;
  return (
    !!s &&
    s.app === "quran-viz" &&
    s.v === 1 &&
    s.kdf === "PBKDF2-SHA256" &&
    typeof s.iter === "number" &&
    [s.salt, s.iv, s.data].every((v) => typeof v === "string")
  );
};

// Deriving takes a moment on a phone; a sync reuses the key it derived last.
const keys = new Map<string, Promise<CryptoKey>>();
function keyFor(passphrase: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const id = `${iter}:${toBase64(salt)}:${passphrase}`;
  let key = keys.get(id);
  if (!key) {
    key = crypto.subtle
      .importKey("raw", text.encode(passphrase), "PBKDF2", false, ["deriveKey"])
      .then((base) =>
        crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        ),
      );
    keys.clear();
    keys.set(id, key);
  }
  return key;
}

/** Seal `plain` with `passphrase`; pass the salt of the copy being replaced to
 *  keep using the key derived for it. */
export async function seal(
  plain: string,
  passphrase: string,
  { salt, iter = KDF_ITERATIONS }: { salt?: Uint8Array<ArrayBuffer>; iter?: number } = {},
): Promise<Sealed> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(passphrase, s, iter);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    text.encode(plain),
  );
  return {
    app: "quran-viz",
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter,
    salt: toBase64(s),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

/** The plain text of a sealed copy, and its salt; throws `WrongPassphrase`. */
export async function unseal(
  sealed: Sealed,
  passphrase: string,
): Promise<{ plain: string; salt: Uint8Array<ArrayBuffer> }> {
  const salt = fromBase64(sealed.salt);
  const key = await keyFor(passphrase, salt, sealed.iter);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv) },
      key,
      fromBase64(sealed.data),
    );
    return { plain: new TextDecoder().decode(plain), salt };
  } catch {
    throw new WrongPassphrase();
  }
}
