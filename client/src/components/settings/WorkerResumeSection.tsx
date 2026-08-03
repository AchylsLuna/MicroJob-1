import { useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "../../lib/toast";
import { deleteResume, uploadResume } from "../../services/api";
import { safeExternalUrl } from "../../utils/safeExternalUrl";
import { ConfirmDialog } from "../ui";
import { validateResumeFile } from "../../lib/profileValidation";

export function WorkerResumeSection({ initialResumeUrl }: { initialResumeUrl: string | null }) {
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
      setStatusMessage(`${file.name} uploaded successfully.`);
      toast.success("Resume uploaded successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload resume.");
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
      setStatusMessage("Resume removed from your profile.");
      toast.success("Resume deleted successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete resume.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="resume-section-title" aria-busy={isSubmitting}>
      <div>
        <h2 id="resume-section-title" className="text-[18px] font-semibold text-[#111827]">CV/Resume</h2>
        <p className="text-[13px] text-[#6B7280]">Upload the resume used for worker applications.</p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
      {safeResumeUrl ? (
        <div className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">{resume?.name || "Resume uploaded"}</p>
            <p className="text-[12px] text-[#64748B]">
              {resume ? `${(resume.size / 1024).toFixed(2)} KB` : "View your uploaded resume"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={safeResumeUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[8px] p-2 text-[#1C4D8D] hover:opacity-90/[0.06]"
              title="Download resume"
              aria-label="Download résumé"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting}
              className="rounded-[8px] p-2 text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-60"
              aria-label="Delete resume"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] border-2 border-dashed border-[#CBD5E1] p-8 text-center">
          <p className="mb-4 text-[14px] text-[#64748B]">Upload your resume (PDF, DOC, or DOCX).</p>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] bg-[#1C4D8D] px-6 py-3 font-semibold text-white hover:opacity-90 focus-within:ring-2 focus-within:ring-[#1C4D8D] focus-within:ring-offset-2">
            <Upload className="h-4 w-4" />
            {isSubmitting ? "Uploading..." : "Choose file"}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
              disabled={isSubmitting}
              aria-label="Choose résumé file"
              className="sr-only"
            />
          </label>
        </div>
      )}
      {safeResumeUrl ? (
        <div className="rounded-[12px] border-2 border-dashed border-[#CBD5E1] p-5 text-center">
          <p className="mb-3 text-[13px] text-[#64748B]">Replace the current résumé with a newer PDF, DOC, or DOCX file.</p>
          <label className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#1C4D8D] px-5 py-2.5 font-semibold text-white focus-within:ring-2 focus-within:ring-[#1C4D8D] focus-within:ring-offset-2 ${isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90"}`}>
            <Upload className="h-4 w-4" />
            {isSubmitting ? "Working..." : "Choose replacement"}
            <input type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={isSubmitting} aria-label="Choose replacement résumé file" className="sr-only" />
          </label>
        </div>
      ) : null}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Remove résumé"
        description="Remove this résumé from your profile? Employers will no longer be able to access it."
        confirmLabel="Remove résumé"
        destructive
        pending={isSubmitting}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
