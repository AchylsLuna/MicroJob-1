import svgPaths from "../imports/svg-at917c2et3";

interface MicroJobsLogoProps {
  className?: string;
  variant?: "dark" | "light";
  onClick?: () => void;
}

export function MicroJobsLogo({ className = "", variant = "dark", onClick }: MicroJobsLogoProps) {
  const textColor = variant === "light" ? "text-white" : "text-[#111827]";
  const iconColor = variant === "light" ? "#ffffff" : "#1C4D8D";

  const content = (
    <>
      <div className="relative shrink-0 w-10 h-10">
        <svg className="block w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
          <path clipRule="evenodd" d={svgPaths.pb82c00} fill={iconColor} fillRule="evenodd" />
          <path clipRule="evenodd" d={svgPaths.p9a9cd00} fill={iconColor} fillRule="evenodd" />
        </svg>
      </div>
      <span className={`text-[22px] md:text-[24px] font-semibold tracking-tight ${textColor}`}>Micro Jobs</span>
    </>
  );

  if (onClick) {
    return <button type="button" className={`flex items-center gap-3 ${className}`} onClick={onClick} aria-label="Micro Jobs home">{content}</button>;
  }

  return <div className={`flex items-center gap-3 ${className}`} role="img" aria-label="Micro Jobs">{content}</div>;
}
