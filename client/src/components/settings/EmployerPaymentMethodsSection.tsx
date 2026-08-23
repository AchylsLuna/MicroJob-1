import { useEffect, useRef, useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import {
  addPaymentMethod,
  getPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type SavedPaymentMethod,
} from "../../services/api";
import { ConfirmDialog, Input } from "../ui";

const normalizeCardNumber = (value: string) => value.replace(/\D/g, "");

const isValidCardNumber = (value: string) => {
  const digits = normalizeCardNumber(value);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

const parseCardExpiry = (value: string) => {
  const match = value.trim().match(/^(0?[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const expiryMonth = Number(match[1]);
  const expiryYear = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  const now = new Date();
  const expired =
    expiryYear < now.getFullYear() ||
    (expiryYear === now.getFullYear() && expiryMonth < now.getMonth() + 1);
  return expired ? null : { expiryMonth, expiryYear };
};

const getBrand = (number: string): SavedPaymentMethod["brand"] => {
  if (number.startsWith("4")) return "Visa";
  if (number.startsWith("5")) return "Mastercard";
  return "Card";
};

export function EmployerPaymentMethodsSection() {
  const { t } = useTranslation("employer");
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [newCard, setNewCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [removeTarget, setRemoveTarget] = useState<SavedPaymentMethod | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getPaymentMethods()
      .then((response) => {
        if (mounted) setPaymentMethods(response.paymentMethods || []);
      })
      .catch((error) => {
        if (mounted) toast.error(error?.message || t("paymentMethods.toast.loadFailed"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const openForm = () => {
    setIsFormOpen(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const handleAdd = async () => {
    const errors: Record<string, string> = {};
    if (!newCard.name.trim()) errors.name = t("paymentMethods.form.errors.name");
    const digits = normalizeCardNumber(newCard.number);
    if (!isValidCardNumber(digits)) errors.number = t("paymentMethods.form.errors.number");
    const parsedExpiry = parseCardExpiry(newCard.expiry);
    if (!parsedExpiry) errors.expiry = t("paymentMethods.form.errors.expiry");
    if (!/^\d{3,4}$/.test(newCard.cvv.trim())) errors.cvv = t("paymentMethods.form.errors.cvv");
    setCardErrors(errors);
    if (Object.keys(errors).length || !parsedExpiry) return;

    setIsSaving(true);
    try {
      const response = await addPaymentMethod({
        cardholderName: newCard.name.trim(),
        brand: getBrand(digits),
        last4: digits.slice(-4),
        ...parsedExpiry,
      });
      setPaymentMethods((current) => [response.paymentMethod, ...current]);
      setNewCard({ name: "", number: "", expiry: "", cvv: "" });
      setCardErrors({});
      setIsFormOpen(false);
      toast.success(response.message || t("paymentMethods.toast.addSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("paymentMethods.toast.addFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActionId(id);
    try {
      const response = await setDefaultPaymentMethod(id);
      setPaymentMethods(response.paymentMethods || []);
      toast.success(response.message || t("paymentMethods.toast.defaultUpdateSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("paymentMethods.toast.defaultUpdateFailed"));
    } finally {
      setActionId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setActionId(id);
    try {
      const response = await removePaymentMethod(id);
      setPaymentMethods(response.paymentMethods || []);
      toast.success(response.message || t("paymentMethods.toast.removeSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("paymentMethods.toast.removeFailed"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-[#111827]">{t("paymentMethods.title")}</h2>
            <p className="text-[13px] text-[#6B7280]">{t("paymentMethods.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={openForm}
            className="self-start rounded-[10px] border border-[#1C4D8D]/20 bg-[#1C4D8D]/[0.06] px-4 py-2 text-[14px] font-semibold text-[#1C4D8D] hover:opacity-90/10 sm:self-auto"
          >
            {t("paymentMethods.addNewCard")}
          </button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-[14px] border border-[#E5E7EB] p-5 text-[14px] text-[#6B7280]">
              {t("paymentMethods.loading")}
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E2E8F0] text-[#475569]">
                <CreditCard className="h-6 w-6" />
              </div>
              <p className="text-[15px] font-semibold text-[#111827]">{t("paymentMethods.emptyState.title")}</p>
              <p className="mt-1 text-[13px] text-[#64748B]">{t("paymentMethods.emptyState.subtitle")}</p>
              <button
                type="button"
                onClick={openForm}
                className="mt-4 rounded-[10px] bg-[#1C4D8D] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
              >
                {t("paymentMethods.emptyState.addFirstCard")}
              </button>
            </div>
          ) : (
            paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex flex-col gap-4 rounded-[14px] border border-[#E5E7EB] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-[10px] border border-[#E5E7EB] text-[12px] font-semibold">
                    {method.brand}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#111827]">
                      {t("paymentMethods.card.endingIn", { brand: method.brand, last4: method.last4 })}
                    </p>
                    <p className="truncate text-[12px] text-[#6B7280]">
                      {t("paymentMethods.card.holderExpiry", { name: method.cardholderName, expiry: method.expiry })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  {method.status === "default" && (
                    <span className="rounded-full bg-[#0F172A] px-3 py-1 text-[11px] font-semibold text-white">
                      {t("paymentMethods.card.default")}
                    </span>
                  )}
                  {method.status === "expired" && (
                    <span className="rounded-full bg-[#FEE2E2] px-3 py-1 text-[11px] font-semibold text-[#B91C1C]">
                      {t("paymentMethods.card.expired")}
                    </span>
                  )}
                  {method.status === "active" && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(method.id)}
                      disabled={actionId === method.id}
                      className="text-[13px] text-[#1C4D8D] disabled:opacity-50"
                    >
                      {actionId === method.id ? t("paymentMethods.card.saving") : t("paymentMethods.card.setDefault")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(method)}
                    disabled={actionId === method.id}
                    aria-label={t("paymentMethods.card.removeAria", { brand: method.brand, last4: method.last4 })}
                    className="rounded-[8px] p-2 text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isFormOpen && (
        <div ref={formRef} className="scroll-mt-6 rounded-[16px] border border-[#E5E7EB] bg-white p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-[#111827]">{t("paymentMethods.form.title")}</h3>
              <p className="mt-1 text-[12px] text-[#64748B]">
                {t("paymentMethods.form.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-[13px] font-medium text-[#64748B]"
            >
              {t("paymentMethods.form.cancel")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t("paymentMethods.form.nameLabel")}
              type="text"
              value={newCard.name}
              onChange={(event) => setNewCard({ ...newCard, name: event.target.value })}
              placeholder={t("paymentMethods.form.namePlaceholder")}
              error={cardErrors.name}
              autoComplete="cc-name"
              maxLength={80}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px]"
            />
            <Input
              label={t("paymentMethods.form.expiryLabel")}
              type="text"
              value={newCard.expiry}
              onChange={(event) => setNewCard({ ...newCard, expiry: event.target.value })}
              placeholder={t("paymentMethods.form.expiryPlaceholder")}
              error={cardErrors.expiry}
              autoComplete="cc-exp"
              inputMode="numeric"
              maxLength={7}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px]"
            />
            <Input
              label={t("paymentMethods.form.numberLabel")}
              type="text"
              value={newCard.number}
              onChange={(event) => {
                const digits = normalizeCardNumber(event.target.value).slice(0, 19);
                setNewCard({ ...newCard, number: digits.match(/.{1,4}/g)?.join(" ") || "" });
              }}
              placeholder={t("paymentMethods.form.numberPlaceholder")}
              error={cardErrors.number}
              autoComplete="cc-number"
              inputMode="numeric"
              maxLength={23}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px]"
            />
            <Input
              label={t("paymentMethods.form.cvvLabel")}
              type="password"
              value={newCard.cvv}
              onChange={(event) =>
                setNewCard({ ...newCard, cvv: event.target.value.replace(/\D/g, "").slice(0, 4) })
              }
              placeholder={t("paymentMethods.form.cvvPlaceholder")}
              error={cardErrors.cvv}
              autoComplete="cc-csc"
              inputMode="numeric"
              maxLength={4}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px]"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isSaving}
            className="mt-4 rounded-[12px] bg-[#1C4D8D] px-6 py-3 font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? t("paymentMethods.form.saving") : t("paymentMethods.form.saveCard")}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={t("paymentMethods.removeDialog.title")}
        description={t("paymentMethods.removeDialog.description", {
          brand: removeTarget?.brand || t("paymentMethods.removeDialog.defaultBrand"),
          last4: removeTarget?.last4 || t("paymentMethods.removeDialog.defaultLast4"),
        })}
        confirmLabel={t("paymentMethods.removeDialog.confirm")}
        destructive
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => { if (!removeTarget) return; await handleRemove(removeTarget.id); setRemoveTarget(null); }}
      />
    </div>
  );
}
