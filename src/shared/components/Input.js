"use client";

import { useId } from "react";
import { cn } from "@/shared/utils/cn";

import { Icon } from "@/shared/components/Icon";
export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  ...props
}) {
  const generatedId = useId();
  const inputId = props.id || generatedId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
            <Icon name={icon} className="text-[16px]" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={cn(
            "w-full h-[34px] py-1.5 px-3 text-sm text-text-main bg-surface rounded-md",
            "border border-border placeholder:text-text-subtle",
            "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
            "transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
            "text-[16px] sm:text-sm",
            icon && "pl-10",
            error && "border-danger focus:ring-danger/20 focus:border-danger",
            inputClassName
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}
