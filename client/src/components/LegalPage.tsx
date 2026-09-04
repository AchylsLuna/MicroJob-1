import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LEGAL_INFO } from "../constants/legal";
import { LEGAL_DOCUMENTS, isLegalDocId, type LegalDocId } from "../constants/legalDocuments";
import { ROUTES } from "../utils/routes";

const { legalEntity, supportEmail, supportPhone, supportPhoneHref, effectiveDate } = LEGAL_INFO;

/**
 * All three legal documents behind one route, chosen from a side list.
 *
 * Replaces the former TermsAndConditions / PrivacyPolicy / CookiePolicy pages,
 * which were three copies of the same shell. `/terms`, `/privacy` and
 * `/cookie-policy` now redirect here with the matching `?doc=`.
 */
export function LegalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const docParam = searchParams.get("doc");
  const activeId: LegalDocId = isLegalDocId(docParam) ? docParam : "terms";
  const activeDoc = LEGAL_DOCUMENTS.find((doc) => doc.id === activeId) ?? LEGAL_DOCUMENTS[0];

  // `replace` so switching documents never stacks history entries — otherwise
  // Back from here stops returning to wherever the reader came from.
  const selectDoc = (id: LegalDocId) => setSearchParams({ doc: id }, { replace: true });

  // React Router only assigns the key "default" to the first entry of a
  // session, so this distinguishes "came from inside the app" from "opened this
  // link directly". The old pages always pushed home, which dropped people out
  // of sign-up mid-form.
  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(ROUTES.home);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[13px] font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          {/* min-w-0 is load-bearing: a grid item defaults to min-width:auto,
              so without it this nav stretches to fit its nowrap document list
              and pushes the whole page into horizontal scroll on narrow
              screens instead of scrolling inside itself. */}
          <nav
            aria-label="Legal documents"
            className="min-w-0 rounded-[16px] border border-[#E5E7EB] bg-white p-2 shadow-sm"
          >
            <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {LEGAL_DOCUMENTS.map((doc) => {
                const selected = doc.id === activeDoc.id;
                return (
                  <li key={doc.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => selectDoc(doc.id)}
                      aria-current={selected ? "page" : undefined}
                      className={`w-full whitespace-nowrap rounded-[10px] px-4 py-3 text-left text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] lg:whitespace-normal ${
                        selected
                          ? "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]"
                          : "text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
                      }`}
                    >
                      {doc.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <article className="min-w-0 rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-10">
            <div className="mb-8 border-b border-[#E5E7EB] pb-6">
              <h1 className="text-[30px] font-bold leading-tight text-[#111827]">{activeDoc.title}</h1>
              <p className="mt-2 text-[14px] text-[#6B7280]">Effective date: {effectiveDate}</p>
            </div>

            <div className="space-y-7">
              {activeDoc.sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-[19px] font-semibold text-[#111827]">{section.title}</h2>
                  <div className="mt-3 space-y-3">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index} className="text-[15px] leading-7 text-[#4B5563]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <h2 className="text-[15px] font-semibold text-[#111827]">{activeDoc.contactHeading}</h2>
              {activeDoc.showLegalEntity ? (
                <p className="mt-2 text-[14px] text-[#4B5563]">{legalEntity}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-[14px]">
                <a className="font-medium text-[#1C4D8D] hover:opacity-80" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
                <a className="font-medium text-[#1C4D8D] hover:opacity-80" href={supportPhoneHref}>
                  {supportPhone}
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
