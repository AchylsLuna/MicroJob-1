import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JobDetailPanel } from "./job/JobDetailPanel";

/**
 * Route wrapper for /worker/job-details/:jobId. All the fetch/apply/save/
 * message logic lives in JobDetailPanel so it can also render inside the
 * split-pane Find Jobs view — this file only owns the page chrome (the back
 * button and the max-width container) that a standalone page needs but an
 * embedded pane doesn't.
 */
export function JobDetails() {
  const { t } = useTranslation("worker");
  const navigate = useNavigate();
  const { jobId } = useParams();

  return (
    <div className="max-w-[1341px] mx-auto space-y-6 font-sans">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#111827] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("jobDetails.backToJobs")}
      </button>
      <JobDetailPanel jobId={jobId} />
    </div>
  );
}
