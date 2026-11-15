import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../i18n/I18nContext";
import { useReaderPrefs } from "./readerShared";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

describe("useReaderPrefs glossLang", () => {
  afterEach(() => localStorage.clear());

  it("follows the UI language when nothing is stored", () => {
    localStorage.setItem("qv.lang", JSON.stringify("id"));
    expect(renderHook(useReaderPrefs, { wrapper }).result.current.glossLang).toBe("id");
    localStorage.clear();
    localStorage.setItem("qv.lang", JSON.stringify("en"));
    expect(renderHook(useReaderPrefs, { wrapper }).result.current.glossLang).toBe("en");
  });

  it("keeps a stored choice", () => {
    localStorage.setItem("qv.lang", JSON.stringify("id"));
    localStorage.setItem("qv.reader.glossLang", JSON.stringify("en"));
    expect(renderHook(useReaderPrefs, { wrapper }).result.current.glossLang).toBe("en");
  });
});
