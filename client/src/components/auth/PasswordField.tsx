import type { Ref } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authFieldClass, authFieldErrorClass, authLabelClass } from "./AuthShell";

/**
 * Password input with a show/hide toggle, replacing the four hand-rolled
 * copies that were spread across the auth screens. The toggle is a full 44px
 * target — two of the old inline versions were icon-sized and below it.
 *
 * Supports both controlled use (value/onChange) and uncontrolled use via
 * `inputRef`, because SignIn deliberately never holds the password in state.
 */
type PasswordFieldProps = {
  id: string;
  label: string;
  showLabel: string;
  hideLabel: string;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  invalid?: boolean;
};

export function PasswordField({
  id,
  label,
  showLabel,
  hideLabel,
  visible,
  onToggle,
  autoComplete,
  placeholder,
  value,
  onChange,
  inputRef,
  disabled,
  invalid,
}: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          {...(onChange ? { value: value ?? "", onChange: (event) => onChange(event.target.value) } : {})}
          className={`${authFieldClass} pr-14 ${invalid ? authFieldErrorClass : ""}`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D]"
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
