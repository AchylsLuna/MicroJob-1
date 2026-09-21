import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";
import { useTranslation } from "react-i18next";
import { ClipboardList, FileText, MapPin, WalletCards } from "lucide-react";
import { DateField } from "../ui/DateField";
import { formatCurrency } from "../../lib/formatters";
import {
  type FormState,
  type JobEdit,
  type ProvinceOption,
  type CityOption,
  type BarangayOption,
  type RequiredFieldKey,
  getJobTypeOptions,
  getRequiredFieldLabels,
  composeLocation,
  parseDateInputValue,
  formatDateInputValue,
  validateStep,
} from "./postJobForm";

const focusField = (key: RequiredFieldKey) => {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `[data-field="${key}"]`
    );
    if (!target) return;
    target.focus();
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
};

type PostJobWizardProps = {
  formData: FormState;
  setFormData: React.Dispatch<React.SetStateAction<FormState>>;
  editingJob: JobEdit | null;
  categories: { _id: string; name: string }[];
  provinceOptions: ProvinceOption[];
  cityOptions: CityOption[];
  barangayOptions: BarangayOption[];
  isLoadingLocationData: boolean;
  isLoadingBarangays: boolean;
  submitting: boolean;
  formError: string | null;
  hasInsufficientBalanceError: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
};

const STEP_KEYS = ["job", "whereWhen", "payReview"] as const;

export default function PostJobWizard({
  formData,
  setFormData,
  editingJob,
  categories,
  provinceOptions,
  cityOptions,
  barangayOptions,
  isLoadingLocationData,
  isLoadingBarangays,
  submitting,
  formError,
  hasInsufficientBalanceError,
  onSubmit,
  onCancel,
}: PostJobWizardProps) {
  const { t } = useTranslation("employer");
  const prefersReducedMotion = useReducedMotion();
  const jobTypeOptions = useMemo(() => getJobTypeOptions(t), [t]);
  const requiredFieldLabels = useMemo(() => getRequiredFieldLabels(t), [t]);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const selectedProvince = provinceOptions.find(
    (item) => item.name.toLowerCase() === formData.province.trim().toLowerCase()
  );
  const filteredCityOptions = selectedProvince?.code
    ? cityOptions.filter((item) => item.provinceCode === selectedProvince.code)
    : cityOptions;

  const estimatedEscrow = useMemo(() => {
    const payPerWorker = Number(formData.minimumSalary.replace(/[^0-9]/g, "") || 0);
    const workerCount = Number(formData.positionsNeeded || 0);
    if (!Number.isFinite(payPerWorker) || !Number.isInteger(workerCount) || workerCount < 1) {
      return 0;
    }
    return payPerWorker * workerCount;
  }, [formData.minimumSalary, formData.positionsNeeded]);

  const selectedCategoryName = categories.find((c) => c._id === formData.category)?.name || "";

  const goNext = () => {
    const missing = validateStep(step, formData);
    if (missing.length > 0) {
      setStepError(
        t("postJob.errors.missingFields", {
          fields: missing.map((field) => requiredFieldLabels[field]).join(", "),
        })
      );
      focusField(missing[0]);
      return;
    }
    setStepError(null);
    setStep((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s));
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : s));
  };

  const goToStep = (index: 0 | 1 | 2) => {
    if (index <= step) {
      setStepError(null);
      setStep(index);
    }
  };

  const stepMotionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -16 },
        transition: { duration: seconds(motionTokens.duration.fast) },
      };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && !hasInsufficientBalanceError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700" role="alert">
          <p>{formError}</p>
        </div>
      )}
      {stepError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700" role="alert">
          <p>{stepError}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {STEP_KEYS.map((key, index) => (
          <React.Fragment key={key}>
            <button
              type="button"
              onClick={() => goToStep(index as 0 | 1 | 2)}
              disabled={index > step}
              aria-current={index === step ? "step" : undefined}
              aria-label={t("postJob.wizard.stepAria", {
                step: index + 1,
                total: STEP_KEYS.length,
                title: t(`postJob.wizard.steps.${key}.title`),
              })}
              className={`h-2.5 w-2.5 rounded-full transition ${
                index <= step ? "bg-[#1C4D8D]" : "bg-[#E5E7EB]"
              } ${index < step ? "cursor-pointer" : index === step ? "" : "cursor-not-allowed"}`}
            />
            {index < STEP_KEYS.length - 1 && <div className="h-px w-8 bg-[#E5E7EB]" aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#1C4D8D]">
        {t("postJob.wizard.stepAria", {
          step: step + 1,
          total: STEP_KEYS.length,
          title: t(`postJob.wizard.steps.${STEP_KEYS[step]}.title`),
        })}
      </p>

      <AnimatePresence mode="wait">
        <motion.div key={step} {...stepMotionProps}>
          {step === 0 && (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{t("postJob.wizard.steps.job.title")}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{t("postJob.wizard.steps.job.subtitle")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="job-title" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.fields.jobTitle.label")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="job-title"
                    type="text"
                    data-field="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t("postJob.modal.fields.jobTitle.placeholder")}
                    maxLength={100}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="job-category" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.fields.category.label")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="job-category"
                    data-field="category"
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">{t("postJob.modal.fields.category.placeholder")}</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="job-description" className="mb-2 block text-sm font-semibold text-slate-700">
                  {t("postJob.description.label")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="job-description"
                  data-field="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[140px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder={t("postJob.description.placeholder")}
                  maxLength={3000}
                  required
                />
                <p className="mt-2 text-right text-xs text-slate-400">
                  {t("postJob.description.counter", { count: formData.description.length })}
                </p>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{t("postJob.wizard.steps.whereWhen.title")}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{t("postJob.wizard.steps.whereWhen.subtitle")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="job-province" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.location.province.label")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="job-province"
                    data-field="location"
                    value={formData.province}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, province: e.target.value, city: "", barangay: "" }))
                    }
                    disabled={isLoadingLocationData}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {isLoadingLocationData
                        ? t("postJob.modal.location.province.loading")
                        : t("postJob.modal.location.province.placeholder")}
                    </option>
                    {provinceOptions.map((province) => (
                      <option key={province.code} value={province.name}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="job-city" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.location.city.label")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="job-city"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value, barangay: "" }))}
                    disabled={isLoadingLocationData || !formData.province}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {!formData.province
                        ? t("postJob.modal.location.city.selectProvinceFirst")
                        : isLoadingLocationData
                        ? t("postJob.modal.location.city.loading")
                        : t("postJob.modal.location.city.placeholder")}
                    </option>
                    {filteredCityOptions.map((city) => (
                      <option key={city.code} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="job-barangay" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.location.barangay.label")} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="job-barangay"
                    value={formData.barangay}
                    onChange={(e) => setFormData((prev) => ({ ...prev, barangay: e.target.value }))}
                    disabled={isLoadingBarangays || !formData.city}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {!formData.city
                        ? t("postJob.modal.location.barangay.selectCityFirst")
                        : isLoadingBarangays
                        ? t("postJob.modal.location.barangay.loading")
                        : t("postJob.modal.location.barangay.placeholder")}
                    </option>
                    {barangayOptions.map((barangay) => (
                      <option key={barangay.code} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="job-address" className="mb-2 block text-sm font-semibold text-slate-700">
                  {t("postJob.modal.location.address.label")}{" "}
                  <span className="font-normal text-slate-400">{t("postJob.modal.location.address.optional")}</span>
                </label>
                <input
                  id="job-address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("postJob.modal.location.address.placeholder")}
                />
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <span className="font-semibold text-slate-700">{t("postJob.modal.location.preview.label")}</span>{" "}
                  {composeLocation(formData) || t("postJob.modal.location.preview.placeholder")}
                </span>
              </div>

              <fieldset data-field="jobType">
                <legend className="mb-2 block text-sm font-semibold text-slate-700">
                  {t("postJob.modal.fields.opportunityType")} <span className="text-red-500">*</span>
                </legend>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {jobTypeOptions.map((option) => {
                    const selected = formData.jobType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setFormData((prev) => ({ ...prev, jobType: option.value }))}
                        className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          selected
                            ? "border-blue-600 bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-blue-300"
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${selected ? "text-blue-700" : "text-slate-900"}`}>
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
                {formData.jobType && !jobTypeOptions.some((option) => option.value === formData.jobType) && (
                  <p className="mt-2 text-xs text-amber-700">
                    {t("postJob.modal.legacyTypeWarning", { type: formData.jobType })}
                  </p>
                )}
              </fieldset>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <DateField
                    id="job-deadline"
                    label={t("postJob.modal.deadline.label")}
                    dataField="deadline"
                    required
                    minDate={new Date()}
                    value={formData.deadline ? parseDateInputValue(formData.deadline) : null}
                    onChange={(next) =>
                      setFormData((prev) => ({ ...prev, deadline: next ? formatDateInputValue(next) : "" }))
                    }
                  />
                </div>

                <div>
                  <label htmlFor="job-positions" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.positions.label")}
                  </label>
                  <input
                    id="job-positions"
                    type="number"
                    min={1}
                    value={formData.positionsNeeded}
                    onChange={(e) => setFormData((prev) => ({ ...prev, positionsNeeded: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <>
              <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                    <WalletCards size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{t("postJob.wizard.steps.payReview.title")}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{t("postJob.wizard.steps.payReview.subtitle")}</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="job-minimum-pay" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("postJob.modal.pay.label")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                      ₱
                    </span>
                    <input
                      id="job-minimum-pay"
                      aria-label={t("postJob.modal.pay.ariaLabel")}
                      type="text"
                      data-field="salary"
                      inputMode="numeric"
                      value={formData.minimumSalary}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          minimumSalary: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("postJob.modal.pay.placeholder")}
                      required
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{t("postJob.modal.pay.helper")}</p>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-blue-900">
                      {editingJob ? t("postJob.modal.walletSummary.estimatedValue") : t("postJob.modal.walletSummary.fundsNeeded")}
                    </p>
                    <p className="mt-0.5 text-xs text-blue-700">
                      {t("postJob.modal.walletSummary.formula", {
                        rate: formatCurrency(Number(formData.minimumSalary || 0), { maximumFractionDigits: 0 }),
                        count: Number(formData.positionsNeeded || 0),
                      })}
                    </p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-blue-700">
                    {formatCurrency(estimatedEscrow, { maximumFractionDigits: 0 })}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="job-requirements" className="mb-2 block text-sm font-semibold text-slate-700">
                      {t("postJob.requirements.label")}{" "}
                      <span className="font-normal text-slate-400">{t("postJob.requirements.optional")}</span>
                    </label>
                    <textarea
                      id="job-requirements"
                      value={formData.requirements}
                      onChange={(e) => setFormData((prev) => ({ ...prev, requirements: e.target.value }))}
                      className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder={t("postJob.requirements.placeholder")}
                    />
                  </div>

                  <div>
                    <label htmlFor="job-skills" className="mb-2 block text-sm font-semibold text-slate-700">
                      {t("postJob.skills.label")}{" "}
                      <span className="font-normal text-slate-400">{t("postJob.skills.optional")}</span>
                    </label>
                    <textarea
                      id="job-skills"
                      value={formData.skills}
                      onChange={(e) => setFormData((prev) => ({ ...prev, skills: e.target.value }))}
                      className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      placeholder={t("postJob.skills.placeholder")}
                    />
                    <p className="mt-2 text-xs text-slate-400">{t("postJob.skills.helper")}</p>
                  </div>
                </div>
              </section>

              <section className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900">{t("postJob.wizard.summary.title")}</h3>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5">
                    <dt className="text-slate-500">{t("postJob.wizard.summary.job")}</dt>
                    <dd className="text-right font-medium text-slate-900">{formData.title || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5">
                    <dt className="text-slate-500">{t("postJob.wizard.summary.category")}</dt>
                    <dd className="text-right font-medium text-slate-900">{selectedCategoryName || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5 md:col-span-2">
                    <dt className="text-slate-500">{t("postJob.wizard.summary.location")}</dt>
                    <dd className="text-right font-medium text-slate-900">{composeLocation(formData) || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5">
                    <dt className="text-slate-500">{t("postJob.wizard.summary.jobType")}</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {jobTypeOptions.find((o) => o.value === formData.jobType)?.label || formData.jobType || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5">
                    <dt className="text-slate-500">{t("postJob.wizard.summary.deadline")}</dt>
                    <dd className="text-right font-medium text-slate-900">{formData.deadline || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-1.5">
                    <dt className="text-slate-500">{t("postJob.wizard.summary.positions")}</dt>
                    <dd className="text-right font-medium text-slate-900">{formData.positionsNeeded || "1"}</dd>
                  </div>
                </dl>
              </section>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* The negative bottom offset cancels the scroll container's `py-5`
          (PostJob.tsx), so the bar rests flush against the modal's bottom edge
          rather than floating 20px above it. Verified at a short viewport with
          the body fully scrolled: the buttons stay entirely visible and the bar
          abuts the last summary row without covering it. Not a stray value. */}
      <div className="sticky -bottom-5 z-10 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white px-1 pb-1 pt-5">
        {step === 0 ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            {t("postJob.actions.cancel")}
          </button>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            {t("postJob.wizard.back")}
          </button>
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={goNext}
            className="h-11 rounded-xl bg-[#1C4D8D] text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2"
          >
            {t("postJob.wizard.next")}
          </button>
        ) : (
          <button
            type="submit"
            className="h-11 rounded-xl bg-[#1C4D8D] text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting
              ? editingJob
                ? t("postJob.actions.updating")
                : t("postJob.actions.posting")
              : editingJob
              ? t("postJob.actions.saveChanges")
              : t("postJob.actions.postJobWithPrice", {
                  amount: formatCurrency(estimatedEscrow, { maximumFractionDigits: 0 }),
                })}
          </button>
        )}
      </div>
    </form>
  );
}
