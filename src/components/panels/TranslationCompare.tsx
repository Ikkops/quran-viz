import { useMemo, useRef, useState } from "react";
import { persisted, usePersistentState } from "../../lib/usePersistentState";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus, X } from "lucide-react";
import type { EditionsIndex, Surah, Verse } from "../../types/quran";
import { useTranslations } from "../../data/useTranslation";
import { editionByIdentifier, isRtl, TRANSLITERATION_EDITION } from "../../data/editions";
import { Badge, Card, Select, Toggle } from "../ui";
import { EditionSelect } from "./EditionSelect";
import { useI18n } from "../../i18n/I18nContext";

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export function TranslationCompare({
  surahs,
  verses,
  editions,
  primary,
}: {
  surahs: Surah[];
  verses: Verse[];
  editions: EditionsIndex;
  primary: string;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const known = useMemo(
    () => new Set(editions.editions.map((e) => e.identifier)),
    [editions],
  );
  const [surahId, setSurahId] = usePersistentState("qv.compare.surah", 1, (raw) =>
    Number.isInteger(raw) && (raw as number) >= 1 && (raw as number) <= 114
      ? (raw as number)
      : undefined,
  );
  // Editions removed by a data rebuild are dropped; never leave the list empty.
  const [picked, setPicked] = usePersistentState<string[]>(
    "qv.compare.editions",
    [editions.default],
    (raw) => {
      if (!Array.isArray(raw)) return undefined;
      const ok = raw.filter((x): x is string => typeof x === "string" && known.has(x));
      return ok.length ? [...new Set(ok)] : undefined;
    },
  );
  const [adding, setAdding] = useState(editions.default);
  const [showTranslit, setShowTranslit] = usePersistentState(
    "qv.compare.translit",
    false,
    persisted.bool,
  );

  const idents = useMemo(
    () => (showTranslit ? [TRANSLITERATION_EDITION, ...picked] : picked),
    [picked, showTranslit],
  );
  const { map, loading } = useTranslations(idents);

  const surahVerses = useMemo(
    () => verses.filter((v) => v.s === surahId),
    [verses, surahId],
  );
  const surah = useMemo(() => surahs.find((s) => s.id === surahId), [surahs, surahId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: surahVerses.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 4,
  });

  const addEdition = () => {
    if (!picked.includes(adding)) setPicked([...picked, adding]);
  };
  const removeEdition = (id: string) =>
    setPicked((p) => (p.length > 1 ? p.filter((x) => x !== id) : p));

  return (
    <div className="flex h-full flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <Select
          label={t.common.surah}
          value={surahId}
          onChange={(e) => setSurahId(Number(e.target.value))}
          className="min-w-[200px]"
        >
          {surahs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.number}. {s.nameEn} — {i18n.meaning(s)}
            </option>
          ))}
        </Select>
        <div className="flex items-end gap-2">
          <EditionSelect
            index={editions}
            value={adding}
            onChange={setAdding}
            label={t.compare.addTranslation}
          />
          <button
            onClick={addEdition}
            className="mb-[1px] inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: primary }}
          >
            <Plus size={15} /> {t.compare.add}
          </button>
        </div>
        <Toggle
          checked={showTranslit}
          onChange={setShowTranslit}
          label={t.compare.transliteration}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        {picked.map((id) => {
          const e = editionByIdentifier(editions, id);
          return (
            <Badge key={id} color={primary} className="gap-1.5 px-2.5 py-1">
              {e?.englishName ?? id}
              <button onClick={() => removeEdition(id)} className="hover:text-red-500">
                <X size={12} />
              </button>
            </Badge>
          );
        })}
      </div>

      <Card className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto"
          style={{ contain: "strict" }}
        >
          {surah?.hasBismillah && (
            <p
              dir="rtl"
              className="quran-text border-b border-slate-100 px-4 py-3 text-center text-slate-700 dark:border-slate-700/60 dark:text-slate-200"
            >
              {BASMALA}
            </p>
          )}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const v = surahVerses[vi.index];
              return (
                <div
                  key={v.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={vi.index}
                  className="flex gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <div className="w-14 shrink-0">
                    <Badge color={primary}>
                      {v.s}:{v.a}
                    </Badge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      dir="rtl"
                      className="quran-text mb-2 text-slate-800 dark:text-slate-100"
                    >
                      {v.ar}
                    </p>
                    {showTranslit && (
                      <p className="mb-2 text-sm italic text-slate-500 dark:text-slate-400">
                        {map.get(TRANSLITERATION_EDITION)?.[v.id] ?? (loading ? "…" : "")}
                      </p>
                    )}
                    <div className="grid gap-2 md:grid-cols-2">
                      {picked.map((id) => {
                        const e = editionByIdentifier(editions, id);
                        const rtl = e ? isRtl(e.language) : false;
                        return (
                          <div
                            key={id}
                            className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"
                          >
                            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              {e?.englishName ?? id}
                            </div>
                            <p
                              dir={rtl ? "rtl" : "ltr"}
                              className={
                                rtl
                                  ? "font-arabic text-lg leading-loose text-slate-700 dark:text-slate-200"
                                  : "text-slate-700 dark:text-slate-200"
                              }
                            >
                              {map.get(id)?.[v.id] ?? (loading ? "…" : "")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
