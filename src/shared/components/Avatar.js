"use client";

import { cn } from "@/shared/utils/cn";

export default function Avatar({
  src,
  alt = "Avatar",
  name,
  size = "md",
  className,
}) {
  const sizes = {
    xs: "size-6 text-xs",
    sm: "size-8 text-sm",
    md: "size-10 text-base",
    lg: "size-12 text-lg",
    xl: "size-16 text-xl",
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (src) {
    return (
      <div
        className={cn(
          "rounded-full bg-cover bg-center bg-no-repeat",
          "ring-2 ring-border",
          sizes[size] || sizes.md,
          className
        )}
        style={{ backgroundImage: `url(${src})` }}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        "ring-2 ring-border",
        sizes[size] || sizes.md,
        "bg-primary",
        className
      )}
      role="img"
      aria-label={alt}
    >
      {getInitials(name)}
    </div>
  );
}

