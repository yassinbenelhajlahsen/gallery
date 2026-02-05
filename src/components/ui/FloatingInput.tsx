// frontend/src/components/ui/FloatingInput.tsx
import React from "react";

type FloatingInputProps = {
  id: string;
  type: "text" | "email" | "password" | "date";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  inputRef?: React.RefObject<HTMLInputElement>;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
};

export function FloatingInput({
  id,
  type,
  value,
  onChange,
  label,
  leftIcon,
  rightSlot,
  inputRef,
  autoComplete,
  minLength,
  required = true,
  inputMode,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  disabled = false,
  className = "",
  error,
}: FloatingInputProps) {
  const isPasswordLabel = label?.toLowerCase() === "password";

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] pointer-events-none z-10">
          {leftIcon}
        </div>
      )}
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        disabled={disabled}
        className={`peer w-full ${leftIcon ? "pl-10" : "pl-3"} ${
          rightSlot ? "pr-10" : "pr-3"
        } pt-6 pb-2 bg-white border rounded-lg transition-all
          ${
            error
              ? "border-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              : "border-[#D8ECFF] text-[#333] focus:ring-2 focus:ring-[#D8ECFF] focus:border-transparent"
          }`}
      />
      <label
        htmlFor={id}
        className={`pointer-events-none absolute ${
          leftIcon ? "left-10" : "left-3"
        } transition-all duration-200
          ${
            error
              ? "text-red-500 peer-focus:text-red-500"
              : `${
                  isPasswordLabel ? "text-[#5184b4]" : "text-[#888]"
                } peer-focus:text-[#5184b4]`
          }
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm
          peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs
          ${
            value
              ? "top-2 translate-y-0 text-xs"
              : "top-1/2 -translate-y-1/2 text-sm"
          }`}
      >
        {label}
      </label>
      {rightSlot && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
