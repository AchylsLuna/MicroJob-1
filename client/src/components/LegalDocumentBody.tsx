import { LEGAL_INFO } from "../constants/legal";
import type { LegalDocument } from "../constants/legalDocuments";

const { legalEntity, supportEmail, supportPhone, supportPhoneHref, effectiveDate } = LEGAL_INFO;

/**
 * The content of a single legal document — title, sections, contact block —
 * shared between the full `/legal` page and the sign-up Terms/Privacy dialog
 * so both read from the same source instead of two copies drifting apart.
 */
export function LegalDocumentBody({
  doc,
  /** Skip the title heading — for hosts (like a Dialog) that already show one. */
  hideHeading = false,
}: {
  doc: LegalDocument;
  hideHeading?: boolean;
}) {
  return (
    <>
      {hideHeading ? (
        <p className="mb-6 text-[14px] text-[#6B7280]">Effective date: {effectiveDate}</p>
      ) : (
        <div className="mb-8 border-b border-[#E5E7EB] pb-6">
          <h1 className="text-[30px] font-bold leading-tight text-[#111827]">{doc.title}</h1>
          <p className="mt-2 text-[14px] text-[#6B7280]">Effective date: {effectiveDate}</p>
        </div>
      )}

      <div className="space-y-7">
        {doc.sections.map((section) => (
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
        <h2 className="text-[15px] font-semibold text-[#111827]">{doc.contactHeading}</h2>
        {doc.showLegalEntity ? <p className="mt-2 text-[14px] text-[#4B5563]">{legalEntity}</p> : null}
        <div className="mt-2 flex flex-wrap gap-3 text-[14px]">
          <a className="font-medium text-[#1C4D8D] hover:opacity-80" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          <a className="font-medium text-[#1C4D8D] hover:opacity-80" href={supportPhoneHref}>
            {supportPhone}
          </a>
        </div>
      </div>
    </>
  );
}
