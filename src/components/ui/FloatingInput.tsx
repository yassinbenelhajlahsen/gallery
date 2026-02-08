// src/components/ui/FloatingInput.tsx
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
  // Visual customizations (optional)
  focusColor?: string; // color used for border / ring on focus (hex)
  borderColor?: string; // default border color (hex)
  labelColor?: string; // optional override for the floating label color
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
  focusColor = "#F7DEE2",
  borderColor = "#F0F0F0",
  labelColor,
}: FloatingInputProps) {
  const isPasswordLabel = label?.toLowerCase() === "password";
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888] pointer-events-none z-10">
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
        className={`${className} peer w-full ${leftIcon ? "pl-10" : "pl-4"} ${
          rightSlot ? "pr-10" : "pr-4"
        } pt-6 pb-3 bg-white border-2 rounded-xl shadow-sm transition-all duration-200 text-[#333]`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        // Inline styles used to ensure consistent color removal of native focus UI
        style={{
          borderColor: error ? "#ef4444" : isFocused ? focusColor : borderColor,
          outline: "none",
          WebkitAppearance: "none",
          appearance: "none",
          // Prevent native blue text-fill on autofill in WebKit
          WebkitTextFillColor: "#333",
          color: "#333",
          // show a faint ring using boxShadow when focused (keeps component accessible)
          boxShadow: isFocused
            ? `0 0 0 4px ${focusColor}33` // 20% alpha
            : undefined,
        }}
      />
      <label
        htmlFor={id}
        className={`pointer-events-none absolute ${
          leftIcon ? "left-10" : "left-4"
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
        style={{
          color: error ? "#ef4444" : labelColor ? labelColor : undefined,
        }}
      >
        {/* Render label text and style a trailing '*' red when present */}
        {label?.endsWith("*") ? (
          <>
            {label.slice(0, -1)}
            <span className="text-red-500">*</span>
          </>
        ) : (
          label
        )}
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
