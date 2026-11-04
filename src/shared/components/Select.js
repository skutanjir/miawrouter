"use client";

import { useId } from "react";
import { cn } from "@/shared/utils/cn";

import { Icon } from "@/shared/components/Icon";
export default function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  error,
  hint,
  disabled = false,
  required = false,
  className,
  selectClassName,
  ...props
}) {
  const generatedId = useId();
  const selectId = props.id || generatedId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium text-text-main">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={cn(
            "w-full h-[34px] py-1.5 px-3 pr-10 text-sm text-text-main",
            "bg-surface border border-border rounded-md appearance-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary",
            "transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
            "text-[16px] sm:text-sm",
            error && "border-danger focus:ring-danger/20 focus:border-danger",
            selectClassName
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-muted">
          <Icon name="expand_more" className="text-[18px]" />
        </div>
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
