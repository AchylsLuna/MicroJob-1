import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { confirmTopUp } from "../services/api";
import { ROUTES } from "../utils/routes";

export function TopUpSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your top-up...");

  const referenceNumber = useMemo(() => searchParams.get("ref") || "", [searchParams]);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      if (!referenceNumber) {
        if (!isActive) return;
        setState("error");
        setMessage("Missing top-up reference. Please check your wallet history.");
        return;
      }

      try {
        const result = await confirmTopUp({ referenceNumber });
        if (!isActive) return;
        setState("success");
        setMessage(result?.message || "Top-up confirmed successfully.");
      } catch (error: any) {
        if (!isActive) return;
        setState("error");
        setMessage(error?.message || "Failed to confirm top-up.");
      }
    };

    run();

    return () => {
      isActive = false;
    };
  }, [referenceNumber]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
        <div className="flex items-start gap-3">
          {state === "loading" && <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mt-0.5" />}
          {state === "success" && <CheckCircle2 className="w-6 h-6 text-[#059669] mt-0.5" />}
          {state === "error" && <XCircle className="w-6 h-6 text-[#DC2626] mt-0.5" />}

          <div>
            <h1 className="text-[22px] font-semibold text-[#111827]">
              {state === "loading" && "Processing Top-up"}
              {state === "success" && "Top-up Confirmed"}
              {state === "error" && "Top-up Confirmation Failed"}
            </h1>
            <p className="text-[14px] text-[#4B5563] mt-2">{message}</p>
            {referenceNumber ? (
              <p className="text-[12px] text-[#6B7280] mt-2">Reference: {referenceNumber}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.worker.eWallet)}
            className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-[14px] font-medium hover:bg-[#1E40AF] transition"
          >
            Go to E-Wallet
          </button>
          <Link
            to={ROUTES.worker.dashboard}
            className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[#111827] text-[14px] font-medium hover:bg-[#F9FAFB] transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
