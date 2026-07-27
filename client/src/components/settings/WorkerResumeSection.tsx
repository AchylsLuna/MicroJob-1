import { useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "../../lib/toast";
import { deleteResume, uploadResume } from "../../services/api";

export function WorkerResumeSection({ initialResumeUrl }: { initialResumeUrl: string | null }) {
  const [resume, setResume] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState(initialResumeUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setResumeUrl(initialResumeUrl);
  }, [initialResumeUrl]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    try {
      const response = await uploadResume(file);
      setResume(file);
      setResumeUrl(response?.data?.resumeUrl || null);
      toast.success("Resume uploaded successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload resume.");
    } finally {
      event.target.value = "";
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await deleteResume();
      setResume(null);
      setResumeUrl(null);
      toast.success("Resume deleted successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete resume.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold text-[#111827]">CV/Resume</h2>
        <p className="text-[13px] text-[#6B7280]">Upload the resume used for worker applications.</p>
      </div>
      {resumeUrl ? (
        <div className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">{resume?.name || "Resume uploaded"}</p>
            <p className="text-[12px] text-[#64748B]">
              {resume ? `${(resume.size / 1024).toFixed(2)} KB` : "View your uploaded resume"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={resumeUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[8px] p-2 text-[#2563EB] hover:bg-[#EFF6FF]"
              title="Download resume"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={handleDelete}
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
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-[#2563EB] px-6 py-3 font-semibold text-white hover:bg-[#1D4ED8]">
            <Upload className="h-4 w-4" />
            {isSubmitting ? "Uploading..." : "Choose file"}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
              disabled={isSubmitting}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
}
