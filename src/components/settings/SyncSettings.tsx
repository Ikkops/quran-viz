import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { Button } from "../ui";
import {
  readConfig,
  saveConfig,
  stopSync,
  syncNow,
  useSyncStatus,
} from "../../lib/sync/engine";

/** Where a fine-grained token is made (the learner sets Gists: read and write). */
const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

const FIELD =
  "min-h-10 w-full rounded border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle touch:min-h-11";

/** Settings → Sync between devices: set up with a token and a passphrase,
 *  then the last sync, "Sync now" and "Stop". */
export function SyncSettings() {
  const { t, lang } = useI18n();
  const s = t.settings.sync;
  const status = useSyncStatus();
  const [on, setOn] = useState(() => readConfig() !== null);
  const [token, setToken] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // "Last synced 3 minutes ago" moves on by itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ago = (at: number) => {
    // A sync that finished after the last tick reads "just now".
    const sec = Math.round((now - at) / 1000);
    if (sec < 60) return s.justNow;
    const rel = new Intl.RelativeTimeFormat(lang === "id" ? "id" : "en", {
      numeric: "auto",
    });
    if (sec < 3600) return rel.format(-Math.round(sec / 60), "minute");
    if (sec < 86_400) return rel.format(-Math.round(sec / 3600), "hour");
    return rel.format(-Math.round(sec / 86_400), "day");
  };
  const line =
    status.state === "syncing"
      ? s.syncing
      : status.last
        ? s.last(ago(status.last))
        : s.never;

  if (!on)
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!token.trim() || !passphrase) return;
          saveConfig({ token: token.trim(), passphrase });
          setToken("");
          setPassphrase("");
          setOn(true);
          void syncNow();
        }}
      >
        <p className="text-sm text-ink-muted">{s.help}</p>
        <div className="flex flex-col gap-1 text-sm text-ink">
          <p>{s.step}</p>
          <a
            href={TOKEN_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start font-medium text-illumination underline-offset-2 hover:underline"
          >
            {s.tokenLink} <ExternalLink size={14} aria-hidden />
          </a>
          <p className="text-ink-muted">{s.stepPermission}</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-eyebrow text-ink-subtle">{s.token}</span>
          <input
            id="sync-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-eyebrow text-ink-subtle">{s.passphrase}</span>
          <input
            id="sync-passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className={FIELD}
          />
          <span className="text-xs text-ink-subtle">{s.passphraseHelp}</span>
        </label>
        <Button
          type="submit"
          variant="primary"
          disabled={!token.trim() || !passphrase}
          className="self-start"
        >
          {s.start}
        </Button>
      </form>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{s.help}</p>
      <p aria-live="polite" className="text-sm text-ink">
        {line}
      </p>
      {status.state === "error" && status.problem && (
        <p role="alert" className="text-sm text-ink">
          {s.problems[status.problem]}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void syncNow()} disabled={status.state === "syncing"}>
          {s.now}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            stopSync();
            setOn(false);
          }}
        >
          {s.stop}
        </Button>
      </div>
    </div>
  );
}
