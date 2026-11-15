import { useState } from "react";
import { BookOpenCheck } from "lucide-react";
import { addDays, dayDate, dayKey } from "../../data/readingLog";
import { khatamPlan, useKhatam, type KhatamPlan } from "../../lib/khatam";
import { useI18n } from "../../i18n/I18nContext";
import type { Messages } from "../../i18n/en";
import { Button, Card } from "../ui";

function statusText(k: Messages["khatam"], plan: KhatamPlan, n: (x: number) => string) {
  const s = plan.status;
  if (s.kind === "behind") return k.behind(s.pages, n(s.pages));
  return k[s.kind];
}

function Bar({ progress, label }: { progress: number; label?: string }) {
  const pct = Math.round(progress * 100);
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? pct : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
      className="h-1 overflow-hidden rounded-full bg-line"
    >
      <div className="h-full rounded-full bg-illumination" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Home: today's pages towards the khatam target, opening the reader. Nothing
 *  without a target. */
export function KhatamRow({
  currentPage,
  onOpen,
}: {
  currentPage: number;
  onOpen: () => void;
}) {
  const { t, n } = useI18n();
  const k = t.khatam;
  const [target] = useKhatam();
  if (!target) return null;
  const plan = khatamPlan(target, currentPage, dayKey(new Date()));
  const done = plan.status.kind === "done";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-soft transition-colors hover:bg-surface-sunken"
    >
      <span className="flex w-full items-center gap-3">
        <BookOpenCheck
          size={20}
          aria-hidden
          className={done ? "shrink-0 text-illumination" : "shrink-0 text-ink-subtle"}
        />
        <span className="min-w-0 flex-1 text-heading tabular-nums text-ink">
          {done
            ? k.done
            : plan.today > 0
              ? k.today(plan.today, n(plan.today))
              : k.todayDone}
        </span>
        {!done && (
          <span className="shrink-0 text-sm tabular-nums text-ink-muted">
            {statusText(k, plan, n)}
          </span>
        )}
      </span>
      <span className="block w-full">
        <Bar progress={plan.progress} />
      </span>
    </button>
  );
}

/** Activity → Statistics: set, show, change or remove the khatam target. */
export function KhatamCard({ currentPage }: { currentPage: number }) {
  const { t, n, lang } = useI18n();
  const k = t.khatam;
  const [target, setTarget] = useKhatam();
  const [editing, setEditing] = useState(false);
  const today = dayKey(new Date());
  const tomorrow = addDays(today, 1);
  const [date, setDate] = useState("");
  const valid = date >= tomorrow && !Number.isNaN(dayDate(date).getTime());

  const fmt = (key: string) =>
    new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", {
      day: "numeric",
      month: "short",
      year: key.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    }).format(dayDate(key));

  if (!target || editing) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-heading text-ink">{k.title}</h3>
        {!target && <p className="text-sm text-ink-muted">{k.explain}</p>}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            // A new date restarts the line from where the reader is now.
            setTarget({ start: today, end: date, from: currentPage });
            setEditing(false);
          }}
        >
          <label className="flex flex-col gap-1 text-eyebrow text-ink-muted">
            {k.date}
            <input
              type="date"
              value={date}
              min={tomorrow}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-10 rounded border border-line bg-surface px-3 text-sm font-normal tracking-normal text-ink touch:min-h-11"
            />
          </label>
          <Button type="submit" variant="primary" disabled={!valid}>
            {target ? k.save : k.set}
          </Button>
          {target && (
            <Button variant="quiet" onClick={() => setEditing(false)}>
              {k.cancel}
            </Button>
          )}
        </form>
      </Card>
    );
  }

  const plan = khatamPlan(target, currentPage, today);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-heading text-ink">{k.title}</h3>
        <p className="text-sm text-ink-muted">{k.finishBy(fmt(target.end))}</p>
      </div>
      <p className="text-sm font-medium tabular-nums text-ink" aria-live="polite">
        {statusText(k, plan, n)}
      </p>
      <Bar progress={plan.progress} label={k.progress} />
      {plan.status.kind !== "done" && (
        <p className="text-sm tabular-nums text-ink-muted">
          {k.pagesLeft(plan.pagesLeft, n(plan.pagesLeft))} ·{" "}
          {k.perDay(plan.perDay, n(plan.perDay))}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setDate(target.end >= tomorrow ? target.end : "");
            setEditing(true);
          }}
        >
          {k.change}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setTarget(null)}>
          {k.remove}
        </Button>
      </div>
    </Card>
  );
}
