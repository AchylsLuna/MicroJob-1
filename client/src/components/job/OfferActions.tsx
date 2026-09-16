import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../lib/formatters";
import type { JobOffer } from "../../services/api";

// Ported verbatim from Mobile/pages/employer/EmployerApplications.tsx's
// CandidateCard offer/hired panels -- same three states, same guards. Do not
// diverge from that state machine; if mobile's flow changes, mirror it here.
export type OfferActionsApplication = {
  _id: string;
  status: string;
  job: { salary?: number };
  offer?: JobOffer | null;
  agreedAmount?: number;
  workStatus?: string;
  paymentStatus?: string;
};

const inputClass =
  "h-10 flex-1 min-w-0 rounded-[10px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[10px] bg-[#1C4D8D] px-4 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[10px] border border-[#1C4D8D]/30 bg-[#1C4D8D]/[0.06] px-4 text-[12px] font-semibold text-[#1C4D8D] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const dangerOutlineButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[10px] border border-[#FECACA] px-4 text-[12px] font-semibold text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50";

export function OfferActions({
  application,
  busy,
  onSendOffer,
  onCancelOffer,
  onConfirmHire,
  onAuthorizePayment,
  onReleasePayment,
  onRequestChanges,
}: {
  application: OfferActionsApplication;
  busy: boolean;
  onSendOffer: (amount: number) => void;
  onCancelOffer: () => void;
  onConfirmHire: () => void;
  onAuthorizePayment: () => void;
  onReleasePayment: () => void;
  onRequestChanges: (reason: string) => void;
}) {
  const { t } = useTranslation("employer");
  const [offerAmount, setOfferAmount] = useState("");
  const [changeReason, setChangeReason] = useState("");

  const offer = application.offer ?? null;
  const offerActive = Boolean(offer && (offer.status === "pending" || offer.status === "accepted"));
  const minimumSalary = Number(application.job?.salary || 0);
  const amountNumber = Number(offerAmount);
  const amountValid = offerAmount.trim() !== "" && Number.isFinite(amountNumber) && amountNumber >= minimumSalary;
  const excludedFromOfferPanel = ["Hired", "Rejected", "Withdrawn"].includes(application.status);

  return (
    <div className="space-y-2">
      {!excludedFromOfferPanel && !offerActive ? (
        <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2">
          <p className="text-[12px] font-semibold text-[#111827]">{t("applicationsManagement.offerPanel.title")}</p>
          <p className="text-[11px] text-[#6B7280]">
            {t("applicationsManagement.offerPanel.guaranteedMinimum", { amount: formatCurrency(minimumSalary) })}
          </p>
          <div className="flex gap-2">
            <input
              value={offerAmount}
              onChange={(event) => setOfferAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder={t("applicationsManagement.offerPanel.amountPlaceholder")}
              className={inputClass}
            />
            <button
              type="button"
              disabled={!amountValid || busy}
              onClick={() => onSendOffer(amountNumber)}
              className={primaryButtonClass}
            >
              {t("applicationsManagement.offerPanel.reviewOffer")}
            </button>
          </div>
          {amountNumber > minimumSalary ? (
            <p className="text-[11px] text-[#B45309]">
              {t("applicationsManagement.offerPanel.additionalEscrow", { amount: formatCurrency(amountNumber - minimumSalary) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {offerActive ? (
        <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2">
          <p className="text-[12px] font-semibold text-[#111827]">
            {offer?.status === "accepted"
              ? t("applicationsManagement.offerActive.accepted")
              : t("applicationsManagement.offerActive.awaiting")}
          </p>
          <p className="text-[11px] text-[#6B7280]">
            {t("applicationsManagement.offerActive.escrowBacked", { amount: formatCurrency(offer?.amount) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {offer?.status === "accepted" ? (
              <button type="button" disabled={busy} onClick={onConfirmHire} className={primaryButtonClass}>
                {t("applicationsManagement.offerActive.confirmHire")}
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={onCancelOffer} className={dangerOutlineButtonClass}>
              {t("applicationsManagement.offerActive.cancelOffer")}
            </button>
          </div>
        </div>
      ) : null}

      {application.status === "Hired" ? (
        (() => {
          const paymentStatus = application.paymentStatus || "Secured";
          const workStatus = application.workStatus || "In Progress";
          const canRequestChanges = workStatus === "Submitted" && paymentStatus !== "Paid";
          return (
            <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2">
              <p className="text-[12px] font-semibold text-[#111827]">{t("applicationsManagement.hiredPanel.title")}</p>
              <p className="text-[11px] text-[#6B7280]">
                {t("applicationsManagement.hiredPanel.summary", {
                  amount: formatCurrency(application.agreedAmount || minimumSalary),
                  workStatus,
                  paymentStatus,
                })}
              </p>
              {!["Authorized", "Paid"].includes(paymentStatus) ? (
                <button type="button" disabled={busy} onClick={onAuthorizePayment} className={secondaryButtonClass}>
                  {t("applicationsManagement.hiredPanel.authorizePayment")}
                </button>
              ) : null}
              {workStatus === "Submitted" && paymentStatus !== "Paid" ? (
                <button type="button" disabled={busy} onClick={onReleasePayment} className={primaryButtonClass}>
                  {t("applicationsManagement.hiredPanel.approveAndPay")}
                </button>
              ) : null}
              {canRequestChanges ? (
                <div className="flex gap-2">
                  <input
                    value={changeReason}
                    onChange={(event) => setChangeReason(event.target.value)}
                    placeholder={t("applicationsManagement.hiredPanel.changeReasonPlaceholder")}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={!changeReason.trim() || busy}
                    onClick={() => onRequestChanges(changeReason)}
                    className={secondaryButtonClass}
                  >
                    {t("applicationsManagement.hiredPanel.requestChanges")}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
