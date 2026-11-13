import { Modal, ModalHeader } from "../ui";
import { BASE } from "../../data/base";
import { useI18n } from "../../i18n/I18nContext";

/** What the app is, where its data comes from (with licences), and the two
 *  caveats a learner should know: Makki/Madani attribution and the counts. */
export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const a = t.about;
  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <ModalHeader title={a.title} onClose={onClose} />
      <div className="space-y-6 px-5 pb-6 pt-4 font-reading text-base leading-relaxed text-ink-muted">
        <div className="flex items-start gap-4">
          <img
            src={`${BASE}favicon.svg`}
            alt=""
            aria-hidden
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl ring-1 ring-line"
          />
          <p className="max-w-prose">{a.purpose}</p>
        </div>

        <section aria-labelledby="about-sources">
          <h3
            id="about-sources"
            className="mb-2 font-ui text-base font-semibold text-ink"
          >
            {a.sourcesTitle}
          </h3>
          <dl className="space-y-3">
            {a.sources.map(([what, from]) => (
              <div key={what}>
                <dt className="font-ui text-sm font-medium text-ink">{what}</dt>
                <dd className="max-w-prose">{from}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="about-places">
          <h3 id="about-places" className="mb-1 font-ui text-base font-semibold text-ink">
            {a.placesTitle}
          </h3>
          <p className="max-w-prose">{a.places}</p>
        </section>

        <section aria-labelledby="about-counts">
          <h3 id="about-counts" className="mb-1 font-ui text-base font-semibold text-ink">
            {a.countsTitle}
          </h3>
          <p className="max-w-prose">{t.app.countsNote}</p>
        </section>

        <section aria-labelledby="about-fonts">
          <h3 id="about-fonts" className="mb-1 font-ui text-base font-semibold text-ink">
            {a.fontsTitle}
          </h3>
          <p className="max-w-prose">{a.fonts}</p>
        </section>
      </div>
    </Modal>
  );
}
