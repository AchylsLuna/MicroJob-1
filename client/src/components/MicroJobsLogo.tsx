import { useState } from "react";

interface MicroJobsLogoProps {
  className?: string;
  variant?: "dark" | "light";
  onClick?: () => void;
  markOnly?: boolean;
  ariaLabel?: string;
}

export function MicroJobsLogo({ className = "", variant = "dark", onClick, markOnly = false, ariaLabel = "MicroJobs home" }: MicroJobsLogoProps) {
  const isLight = variant === "light";
  // Only ever set true where the logo is a button (see onClick below) -- a plain
  // brand mark has nothing for a tap to react to.
  const [isSpinning, setIsSpinning] = useState(false);

  const content = (
    <>
      <div
        aria-hidden="true"
        className={`microjobs-logo-mark ${isSpinning ? "microjobs-logo-mark--spin" : ""} flex shrink-0 rotate-[30deg] items-center justify-center ${markOnly ? "h-8 w-8 rounded-[10px]" : "h-[42px] w-[42px] rounded-[13px]"} ${isLight ? "bg-white" : "bg-[#1C4D8D]"}`}
        onAnimationEnd={() => setIsSpinning(false)}
      >
        <span className={`-rotate-[30deg] font-black leading-none ${markOnly ? "text-base" : "text-[21px]"} ${isLight ? "text-[#1C4D8D]" : "text-white"}`}>
          M
        </span>
      </div>
      {!markOnly ? <span className={`microjobs-logo-wordmark shrink text-[24px] font-extrabold leading-none tracking-[-0.6px] ${isLight ? "text-white" : "text-[#1C4D8D]"}`}>
        <span className={isLight ? "text-white" : "text-[#0F2954]"}>Micro</span>Jobs
      </span> : null}
    </>
  );

  if (onClick) {
    const handleClick = () => {
      setIsSpinning(true);
      onClick();
    };
    return <button type="button" className={`microjobs-logo group flex items-center gap-2.5 ${className}`} onClick={handleClick} aria-label={ariaLabel}>{content}</button>;
  }

  return <div className={`microjobs-logo flex items-center gap-2.5 ${className}`} role="img" aria-label="MicroJobs">{content}</div>;
}
