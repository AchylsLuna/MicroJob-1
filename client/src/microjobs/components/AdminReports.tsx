import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Briefcase,
  DollarSign,
  Users,
  ClipboardList,
  Calendar,
  Check,
  ChevronDown,
} from "lucide-react";
import { AdminGate } from "./admin/AdminGate";
import { useAdminData } from "../hooks/useAdminData";
import { toast } from "../lib/toast";

const REPORT_STORAGE_KEY = "admin_reports";

type ReportType = "users" | "jobs" | "transactions" | "applications";

type StoredReport = {
  id: string;
  type: ReportType;
  title: string;
  fromDate?: string;
  toDate?: string;
  format: "CSV" | "JSON";
  createdAt: string;
  status: "completed";
};

function AdminReportsContent() {
  const { isLoading, loadError, users, jobs, formatCurrency } = useAdminData();
  const [reportType, setReportType] = useState<ReportType>("users");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exportFormat, setExportFormat] = useState<"CSV" | "JSON">("CSV");
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [recentReports, setRecentReports] = useState<StoredReport[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as StoredReport[];
      setRecentReports(parsed);
    } catch {
      setRecentReports([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(recentReports.slice(0, 6)));
  }, [recentReports]);

  useEffect(() => {
    if (!showFormatMenu) return;
    const closeMenu = () => setShowFormatMenu(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [showFormatMenu]);

  const reportCards = [
    {
      id: "users" as const,
      title: "User Report",
      description: "Complete list of all registered users with their profiles and activity",
      icon: <Users className="w-5 h-5 text-[#2563EB]" />,
      accent: "bg-[#EFF6FF]",
    },
    {
      id: "jobs" as const,
      title: "Jobs Report",
      description: "All job postings with status, applications count, and performance metrics",
      icon: <Briefcase className="w-5 h-5 text-[#10B981]" />,
      accent: "bg-[#ECFDF3]",
    },
    {
      id: "transactions" as const,
      title: "Transaction Report",
      description: "E-wallet transactions, payments, and financial summary",
      icon: <DollarSign className="w-5 h-5 text-[#F59E0B]" />,
      accent: "bg-[#FEF3C7]",
    },
    {
      id: "applications" as const,
      title: "Applications Report",
      description: "Job applications with candidate details and hiring status",
      icon: <ClipboardList className="w-5 h-5 text-[#A855F7]" />,
      accent: "bg-[#F3E8FF]",
    },
  ];

  const getDateFromId = (id?: string) => {
    if (!id || id.length < 8) return null;
    const timestamp = parseInt(id.slice(0, 8), 16) * 1000;
    return new Date(timestamp);
  };

  const parseSalary = (value?: string) => {
    if (!value) return 0;
    const matches = value.match(/[\d,.]+/g);
    if (!matches) return 0;
    const numbers = matches
      .map((item) => Number(item.replace(/,/g, "")))
      .filter((num) => Number.isFinite(num));
    if (numbers.length === 0) return 0;
    if (numbers.length >= 2 && value.includes("-")) {
      return (numbers[0] + numbers[1]) / 2;
    }
    return numbers[0];
  };

  const withinRange = (date?: Date | null, rangeFrom?: string, rangeTo?: string) => {
    if (!date) return false;
    if (!rangeFrom && !rangeTo) return true;
    const start = rangeFrom ? new Date(`${rangeFrom}T00:00:00`) : null;
    const end = rangeTo ? new Date(`${rangeTo}T23:59:59`) : null;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  };

  const buildReportData = (type: ReportType, rangeFrom: string, rangeTo: string) => {
    if (type === "users") {
      return users
        .map((user) => {
          const date = getDateFromId(user._id);
          return {
            id: user._id,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
            email: user.email,
            role: user.role || "worker",
            status: user.status || "active",
            joined: date ? date.toLocaleDateString() : "—",
            date,
          };
        })
        .filter((row) => withinRange(row.date, rangeFrom, rangeTo));
    }

    if (type === "jobs") {
      return jobs
        .map((job) => {
          const date = job.createdAt ? new Date(job.createdAt) : getDateFromId(job._id);
          return {
            id: job._id,
            title: job.title,
            status: job.status || "Available",
            salary: job.salary || "—",
            applicants: job.applicants?.length ?? 0,
            posted: date ? date.toLocaleDateString() : "—",
            date,
          };
        })
        .filter((row) => withinRange(row.date, rangeFrom, rangeTo));
    }

    if (type === "transactions") {
      return jobs
        .filter((job) => job.status === "Completed")
        .map((job) => {
          const date = job.createdAt ? new Date(job.createdAt) : getDateFromId(job._id);
          const amountValue = parseSalary(job.salary);
          return {
            id: job._id,
            jobTitle: job.title,
            amount: amountValue ? formatCurrency(amountValue) : "—",
            completed: date ? date.toLocaleDateString() : "—",
            date,
          };
        })
        .filter((row) => withinRange(row.date, rangeFrom, rangeTo));
    }

    return jobs
      .map((job) => {
        const date = job.createdAt ? new Date(job.createdAt) : getDateFromId(job._id);
        return {
          id: job._id,
          jobTitle: job.title,
          applicants: job.applicants?.length ?? 0,
          status: job.status || "Available",
          posted: date ? date.toLocaleDateString() : "—",
          date,
        };
      })
      .filter((row) => withinRange(row.date, rangeFrom, rangeTo));
  };

  const reportData = useMemo(
    () => buildReportData(reportType, fromDate, toDate),
    [reportType, users, jobs, fromDate, toDate, formatCurrency],
  );

  const generateFile = (options?: {
    type?: ReportType;
    rangeFrom?: string;
    rangeTo?: string;
    format?: "CSV" | "JSON";
    skipSave?: boolean;
  }) => {
    const type = options?.type ?? reportType;
    const rangeFrom = options?.rangeFrom ?? fromDate;
    const rangeTo = options?.rangeTo ?? toDate;
    const format = options?.format ?? exportFormat;
    const data = buildReportData(type, rangeFrom, rangeTo);

    if (data.length === 0) {
      toast.error("No data available for the selected filters.");
      return;
    }

    const safeFrom = rangeFrom || "all";
    const safeTo = rangeTo || "all";
    const title = reportCards.find((card) => card.id === type)?.title || "Report";
    const fileName = `${type}-${safeFrom}-${safeTo}.${format.toLowerCase()}`;

    let content = "";
    if (format === "JSON") {
      content = JSON.stringify(data.map(({ date, ...rest }) => rest), null, 2);
    } else {
      const rows = data.map(({ date, ...rest }) => rest);
      const headers = Object.keys(rows[0] || {});
      content = [headers.join(",")]
        .concat(
          rows.map((row) =>
            headers
              .map((key) => `"${String((row as Record<string, unknown>)[key] ?? "").replace(/"/g, '""')}"`)
              .join(","),
          ),
        )
        .join("\n");
    }

    const blob = new Blob([content], { type: format === "JSON" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    if (!options?.skipSave) {
      const newReport: StoredReport = {
        id: `${type}-${Date.now()}`,
        type,
        title,
        fromDate: rangeFrom,
        toDate: rangeTo,
        format,
        createdAt: new Date().toISOString(),
        status: "completed",
      };

      setRecentReports((prev) => [newReport, ...prev].slice(0, 6));
      toast.success("Report generated successfully.");
    }
  };

  const recentLabel = (report: StoredReport) => {
    const created = new Date(report.createdAt);
    return created.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="max-w-[1341px] mx-auto space-y-6">
      {loadError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] px-4 py-3 rounded-[12px] text-[13px]">
          {loadError}
        </div>
      )}

      <section className="bg-white rounded-[20px] border border-[#E5E7EB] p-6 space-y-6">
        <div>
          <h3 className="text-[20px] font-semibold text-[#111827]">Generate Report</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Select report type and date range to generate a downloadable report
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {reportCards.map((card) => {
            const isActive = card.id === reportType;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setReportType(card.id)}
                className={`text-left border rounded-[16px] p-4 transition-all ${
                  isActive
                    ? "border-[#2563EB] bg-[#EFF6FF]"
                    : "border-[#E5E7EB] bg-white hover:border-[#CBD5F5]"
                }`}
              >
                <div className={`w-10 h-10 rounded-[12px] ${card.accent} flex items-center justify-center mb-4`}>
                  {card.icon}
                </div>
                <p className="text-[15px] font-semibold text-[#111827]">{card.title}</p>
                <p className="text-[12px] text-[#6B7280] mt-1">{card.description}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[12px] text-[#6B7280] block mb-2">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-full h-11 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
              />
            </div>
          </div>
          <div>
            <label className="text-[12px] text-[#6B7280] block mb-2">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full h-11 rounded-[12px] border border-[#E5E7EB] pl-9 pr-3 text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]"
              />
            </div>
          </div>
          <div>
            <label className="text-[12px] text-[#6B7280] block mb-2">Export Format</label>
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowFormatMenu((prev) => !prev);
                }}
                className="w-full h-11 rounded-[12px] border border-[#E5E7EB] px-3 text-[13px] text-[#111827] flex items-center justify-between"
              >
                {exportFormat}
                <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
              </button>
              {showFormatMenu && (
                <div className="absolute z-10 mt-2 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg overflow-hidden">
                  {["CSV", "JSON"].map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => {
                        setExportFormat(format as "CSV" | "JSON");
                        setShowFormatMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] ${
                        exportFormat === format
                          ? "bg-[#10B981] text-white"
                          : "text-[#111827] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {exportFormat === format && <Check className="w-4 h-4" />}
                      {format}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => generateFile()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-[14px] bg-[#2563EB] text-white px-5 py-3 text-[13px] font-semibold shadow-sm hover:bg-[#1D4ED8] disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          Generate & Download
        </button>
      </section>

      <section className="bg-white rounded-[20px] border border-[#E5E7EB] p-6 space-y-4">
        <div>
          <h3 className="text-[20px] font-semibold text-[#111827]">Recent Reports</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">Previously generated reports available for download</p>
        </div>

        <div className="space-y-3">
          {recentReports.length === 0 && (
            <div className="text-[13px] text-[#9CA3AF]">No reports generated yet.</div>
          )}
          {recentReports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border border-[#E5E7EB] rounded-[16px]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-[#F1F5F9] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#64748B]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {report.title} {report.fromDate || report.toDate ? `(${report.fromDate || ""}${
                      report.fromDate && report.toDate ? " - " : ""
                    }${report.toDate || ""})` : ""}
                  </p>
                  <p className="text-[12px] text-[#6B7280]">Generated on {recentLabel(report)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF3] text-[#065F46]">
                  <Check className="w-4 h-4" />
                  {report.status}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    generateFile({
                      type: report.type,
                      rangeFrom: report.fromDate || "",
                      rangeTo: report.toDate || "",
                      format: report.format,
                      skipSave: true,
                    });
                  }}
                  className="w-10 h-10 rounded-[12px] border border-[#E5E7EB] flex items-center justify-center hover:bg-[#F8FAFC]"
                >
                  <Download className="w-4 h-4 text-[#64748B]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminReports() {
  return (
    <AdminGate allowedRoles={["superadmin", "admin"]}>
      <AdminReportsContent />
    </AdminGate>
  );
}
