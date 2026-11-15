import type { ReactNode } from "react";
import { RecitationProvider } from "../data/RecitationContext";
import type { Surah, Verse } from "../types/quran";

/** A render `wrapper` with the app-level recitation owner the reader needs. */
export function withRecitation(surahs: Surah[], verses: Verse[], readerOpen = true) {
  return function RecitationWrapper({ children }: { children: ReactNode }) {
    return (
      <RecitationProvider surahs={surahs} verses={verses} readerOpen={readerOpen}>
        {children}
      </RecitationProvider>
    );
  };
}
