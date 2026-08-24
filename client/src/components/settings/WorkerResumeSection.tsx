import { useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { deleteResume, uploadResume } from "../../services/api";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { ConfirmDialog } from "../ui";
import { validateResumeFile } from "../../lib/profileValidation";

export function WorkerResumeSection({ initialResumeUrl }: { initialResumeUrl: string | null }) {
  const { t } = useTranslation("worker");
  const [resume, setResume] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState(initialResumeUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const assetOrigin = apiBase.startsWith("http") ? apiBase.replace(/\/api\/?$/, "") : window.location.origin;
  const resumeCandidate = resumeUrl?.startsWith("/") ? `${assetOrigin}${resumeUrl}` : resumeUrl;
  const safeResumeUrl = safeExternalUrl(resumeCandidate, { purpose: "asset", trustedOrigins: [assetOrigin] });

  useEffect(() => {
    setResumeUrl(initialResumeUrl);
  }, [initialResumeUrl]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateResumeFile(file);
    if (validationError) {
      toast.error(validationError);
      setStatusMessage(validationError);
      event.target.value = "";
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await uploadResume(file);
      setResume(file);
      setResumeUrl(response?.data?.resumeUrl || null);
      setStatusMessage(t("settings.resume.uploadedStatus", { fileName: file.name }));
      toast.success(t("settings.resume.toast.uploadSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.resume.toast.uploadFailed"));
    } finally {
      event.target.value = "";
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteResume();
      setResume(null);
      setResumeUrl(null);
      setShowDeleteConfirm(false);
      setStatusMessage(t("settings.resume.removedStatus"));
      toast.success(t("settings.resume.toast.deleteSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("settings.resume.toast.deleteFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="resume-section-title" aria-busy={isSubmitting}>
      <div>
        <h2 id="resume-section-title" className="text-lg font-semibold text-slate-900">{t("settings.resume.title")}</h2>
        <p className="text-[13px] text-slate-500">{t("settings.resume.subtitle")}</p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
      {safeResumeUrl ? (
        <div className="flex items-center justify-between rounded-[12px] border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-[14px] font-semibold text-slate-900">{resume?.name || t("settings.resume.uploadedLabel")}</p>
            <p className="text-[12px] text-slate-500">
              {resume ? t("settings.resume.fileSizeKb", { size: (resume.size / 1024).toFixed(2) }) : t("settings.resume.viewUploaded")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={safeResumeUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[8px] p-2 text-[#1C4D8D] transition hover:bg-[#1C4D8D]/[0.06]"
              title={t("settings.resume.downloadTitle")}
              aria-label={t("settings.resume.downloadAria")}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
              className="rounded-[8px] p-2 text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-60"
              aria-label={t("settings.resume.deleteAria")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] border-2 border-dashed border-slate-300 p-8 text-center">
          <p className="mb-4 text-[14px] text-slate-500">{t("settings.resume.uploadPrompt")}</p>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] bg-[#1C4D8D] px-6 py-3 font-semibold text-white hover:opacity-90 focus-within:ring-2 focus-within:ring-[#1C4D8D] focus-within:ring-offset-2">
            <Upload className="h-4 w-4" />
            {isSubmitting ? t("settings.resume.uploadingButton") : t("settings.resume.chooseFileButton")}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
              disabled={isSubmitting}
              aria-label={t("settings.resume.chooseFileAria")}
              className="sr-only"
            />
          </label>
        </div>
      )}
      {safeResumeUrl ? (
        <div className="rounded-[12px] border-2 border-dashed border-slate-300 p-5 text-center">
          <p className="mb-3 text-[13px] text-slate-500">{t("settings.resume.replacePrompt")}</p>
          <label className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#1C4D8D] px-5 py-2.5 font-semibold text-white focus-within:ring-2 focus-within:ring-[#1C4D8D] focus-within:ring-offset-2 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90"}`}>
            <Upload className="h-4 w-4" />
            {isSubmitting ? t("settings.resume.workingButton") : t("settings.resume.chooseReplacementButton")}
            <input type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={isSubmitting} aria-label={t("settings.resume.chooseReplacementAria")} className="sr-only" />
          </label>
        </div>
      ) : null}
      <ConfirmDialog
        open={showDeleteConfirm}
        title={t("settings.resume.removeDialog.title")}
        description={t("settings.resume.removeDialog.description")}
        confirmLabel={t("settings.resume.removeDialog.confirmLabel")}
        destructive
        pending={isSubmitting}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
