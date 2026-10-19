import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, WalletCards } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import type { JobOffer } from "../../services/api";
import { DailyWorkSchedule } from '../DailyWorkSchedule';
import { OfferResponseDeadline } from '../OfferResponseDeadline';

// Shared offer/payment guards for application actions and Job History cards.
// The stepped presentation changes labels and layout, not payment transitions.
export type OfferActionsApplication = {
  _id: string;
  status: string;
  job: { salary?: number; paymentMode?: string; workDates?: string[]; workStartTime?: string | null; workEndTime?: string | null };
  offer?: JobOffer | null;
  agreedAmount?: number;
  workStatus?: string;
  paymentStatus?: string;
  paymentDisputeStatus?: string;
};

const compactInputClass =
  "h-10 flex-1 min-w-0 rounded-control border border-[#E5E7EB] px-3 text-body-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-brand";
const compactPrimaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-caption font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const compactSecondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-control border border-brand/30 bg-brand/[0.06] px-4 text-caption font-semibold text-brand transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const compactDangerOutlineButtonClass =
  "inline-flex h-10 items-center justify-center rounded-control border border-[#FECACA] px-4 text-caption font-semibold text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50";

export function OfferActions({
  application,
  busy,
  onSendOffer,
  onCancelOffer,
  onConfirmHire,
  onAuthorizePayment,
  onReleasePayment,
  onRequestChanges,
  stepped = false,
  onReject,
}: {
  application: OfferActionsApplication;
  busy: boolean;
  onSendOffer: (amount: number) => void;
  onCancelOffer: () => void;
  onConfirmHire: () => void;
  onAuthorizePayment: () => void;
  onReleasePayment: () => void;
  onRequestChanges: (reason: string) => void;
  stepped?: boolean;
  onReject?: () => void;
}) {
  const { t } = useTranslation("employer");
  const daily = application.job.paymentMode === 'daily';
  const days = daily ? application.job.workDates?.length || 1 : 1;
  const [offerAmount, setOfferAmount] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const amountId = useId();
  const reasonId = useId();
  const inputClass = stepped
    ? "h-11 w-full flex-1 min-w-0 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-500"
    : compactInputClass;
  const buttonClass = "inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButtonClass = stepped ? `${buttonClass} bg-brand text-white hover:opacity-90` : compactPrimaryButtonClass;
  const secondaryButtonClass = stepped ? `${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50` : compactSecondaryButtonClass;
  const dangerOutlineButtonClass = stepped ? `${buttonClass} border border-red-200 bg-white text-red-700 hover:bg-red-50` : compactDangerOutlineButtonClass;
  const panelClass = stepped
    ? "space-y-5 rounded-card border border-slate-200 bg-white p-4 md:p-6"
    : "rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2";
  const iconClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600";

  const offer = application.offer ?? null;
  const offerActive = Boolean(offer && (offer.status === "pending" || offer.status === "accepted"));
  const minimumSalary = Number(application.job?.salary || 0);
  const amountNumber = Number(offerAmount);
  const amountValid = offerAmount.trim() !== "" && Number.isFinite(amountNumber) && amountNumber >= minimumSalary;
  const excludedFromOfferPanel = ["Hired", "Rejected", "Withdrawn"].includes(application.status);

  return (
    <>
    <OfferResponseDeadline offer={offer} />
    <div className={stepped ? "space-y-5" : "space-y-2"}>
      {daily && <DailyWorkSchedule dates={application.job.workDates || []} rate={minimumSalary} start={application.job.workStartTime} end={application.job.workEndTime} />}
      {!excludedFromOfferPanel && !offerActive ? (
        <div className={panelClass}>
          {stepped ? (
            <div className="flex items-start gap-3">
              <div className={iconClass}><WalletCards size={20} aria-hidden="true" /></div>
              <div><h3 className="font-bold text-slate-900">{t("applicationsManagement.offerPanel.title")}</h3><p className="mt-0.5 text-sm text-slate-500">{t("applicationsManagement.workflow.offerSubtitle")}</p></div>
            </div>
          ) : <p className="text-caption font-semibold text-[#111827]">{t("applicationsManagement.offerPanel.title")}</p>}
          <p className={stepped ? "text-sm text-slate-500" : "text-[11px] text-[#6B7280]"}>
            {t("applicationsManagement.offerPanel.guaranteedMinimum", { amount: formatCurrency(minimumSalary) })}
          </p>
          <div>
            {stepped ? <label htmlFor={amountId} className="mb-2 block text-sm font-semibold text-slate-700">{t("applicationsManagement.offerPanel.amountPlaceholder")}</label> : null}
            <div className={stepped ? "flex flex-col gap-3 sm:flex-row" : "flex gap-2"}>
              <input
                id={amountId}
                aria-label={t("applicationsManagement.offerPanel.amountPlaceholder")}
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
                {t(stepped ? "applicationsManagement.offerPanel.title" : "applicationsManagement.offerPanel.reviewOffer")}
              </button>
            </div>
          </div>
          {amountNumber > minimumSalary ? (
            <p className={stepped ? "text-sm text-amber-700" : "text-[11px] text-[#B45309]"}>
              {t("applicationsManagement.offerPanel.additionalEscrow", { amount: formatCurrency((amountNumber - minimumSalary) * days) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {offerActive ? (
        <div className={panelClass}>
          {stepped ? (
            <div className="flex items-start gap-3">
              <div className={iconClass}>{offer?.status === "accepted" ? <FileText size={20} aria-hidden="true" /> : <WalletCards size={20} aria-hidden="true" />}</div>
              <div>
                <h3 className="font-bold text-slate-900"><span role="status">{t(offer?.status === "accepted" ? "applicationsManagement.workflow.hireQuestion" : "applicationsManagement.workflow.waiting")}</span></h3>
                <p className="mt-0.5 text-sm text-slate-500">{t(offer?.status === "accepted" ? "applicationsManagement.workflow.hireSubtitle" : "applicationsManagement.workflow.reviewSubtitle")}</p>
              </div>
            </div>
          ) : <p className="text-body-sm font-semibold text-[#111827]" role="status">
            {offer?.status === "accepted"
              ? t("applicationsManagement.offerActive.accepted")
              : t("applicationsManagement.offerActive.awaiting")}
          </p>}
          {stepped && offer?.status === "accepted" ? (
            <p role="note" className="rounded-control border border-amber-300 bg-amber-50 p-3 text-body-sm font-bold text-amber-900">
              {t("applicationsManagement.workflow.hireWarning")}
            </p>
          ) : null}
          <p className={stepped ? "text-sm text-slate-500" : "text-[11px] text-[#6B7280]"}>
            {t("applicationsManagement.offerActive.escrowBacked", { amount: formatCurrency(Number(offer?.amount || 0) * days) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {offer?.status === "accepted" ? (
              <button type="button" disabled={busy} onClick={onConfirmHire} className={primaryButtonClass}>
                {t(stepped ? "applicationsManagement.workflow.hire" : "applicationsManagement.offerActive.confirmHire")}
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={stepped && offer?.status === "accepted" ? onReject : onCancelOffer} className={dangerOutlineButtonClass}>
              {t(stepped && offer?.status === "accepted" ? "applicationsManagement.workflow.reject" : "applicationsManagement.offerActive.cancelOffer")}
            </button>
          </div>
        </div>
      ) : null}

      {application.status === "Hired" ? (
        (() => {
          const paymentStatus = application.paymentStatus || "Secured";
          const workStatus = application.workStatus || "In Progress";
          const canRequestChanges = workStatus === "Submitted" && !["Paid", "Disputed"].includes(paymentStatus);
          return (
            <div className={panelClass}>
              {stepped ? (
                <div className="flex items-start gap-3">
                  <div className={iconClass}><WalletCards size={20} aria-hidden="true" /></div>
                  <div><h3 className="font-bold text-slate-900">{t("applicationsManagement.hiredPanel.title")}</h3><p className="mt-0.5 text-sm text-slate-500">{t("applicationsManagement.workflow.paymentSubtitle")}</p></div>
                </div>
              ) : <p className="text-caption font-semibold text-[#111827]">{t("applicationsManagement.hiredPanel.title")}</p>}
              <p className={stepped ? "text-sm text-slate-500" : "text-[11px] text-[#6B7280]"}>
                {t("applicationsManagement.hiredPanel.summary", {
                  amount: formatCurrency(application.agreedAmount || minimumSalary),
                  workStatus,
                  paymentStatus,
                })}
              </p>
              {stepped ? <p className="text-body-sm text-slate-600">{t(`applicationsManagement.workflow.${paymentStatus === "Paid" ? "paymentPaid" : paymentStatus === "Disputed" ? "paymentDisputed" : paymentStatus === "Authorized" ? "paymentAuthorized" : "paymentHelp"}`)}</p> : null}
              {!daily && !["Authorized", "Paid", "Disputed"].includes(paymentStatus) ? (
                <button type="button" disabled={busy} onClick={onAuthorizePayment} className={secondaryButtonClass}>
                  {t("applicationsManagement.hiredPanel.authorizePayment")}
                </button>
              ) : null}
              {workStatus === "Submitted" && !["Paid", "Disputed"].includes(paymentStatus) ? (
                <button type="button" disabled={busy} onClick={onReleasePayment} className={primaryButtonClass}>
                  {t("applicationsManagement.hiredPanel.approveAndPay")}
                </button>
              ) : null}
              {workStatus === "Submitted" && paymentStatus === "Disputed" ? (
                <p className={stepped ? "rounded-xl bg-amber-50 p-4 text-sm text-amber-900" : "rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900"}>
                  {t("applicationsManagement.hiredPanel.paymentOnHold")}
                </p>
              ) : null}
              {canRequestChanges ? (
                <div>
                  {stepped ? <label htmlFor={reasonId} className="mb-2 block text-sm font-semibold text-slate-700">{t("applicationsManagement.hiredPanel.changeReasonPlaceholder")}</label> : null}
                  <div className={stepped ? "flex flex-col gap-3 sm:flex-row" : "flex gap-2"}>
                    <input
                      id={reasonId}
                      aria-label={t("applicationsManagement.hiredPanel.changeReasonPlaceholder")}
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
                </div>
              ) : null}
            </div>
          );
        })()
      ) : null}
    </div>
    </>
  );
}
