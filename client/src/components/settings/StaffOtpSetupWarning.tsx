import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Dialog } from "../ui";

export function StaffOtpSetupWarning() {
  const { user } = useAuth();
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(Boolean(user?.role === "admin" && user.otpEnabled === false && !user.passwordChangeRequired
      && sessionStorage.getItem("staff_otp_setup_warning") === user.id));
  }, [user?.id, user?.role, user?.otpEnabled, user?.passwordChangeRequired]);
  const dismiss = () => { sessionStorage.removeItem("staff_otp_setup_warning"); setOpen(false); };
  return <Dialog open={open} title={t("staffOtp.warningTitle")} description={t("staffOtp.warningDescription")} onClose={dismiss}>
    <AlertTriangle className="h-8 w-8 text-amber-600 mb-4" aria-hidden="true" />
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => { dismiss(); navigate("/settings?tab=personal"); }}>{t("staffOtp.setup")}</Button>
      <Button onClick={dismiss} className="!bg-slate-100 !text-slate-700 hover:!bg-slate-200">{t("staffOtp.later")}</Button>
    </div>
  </Dialog>;
}
