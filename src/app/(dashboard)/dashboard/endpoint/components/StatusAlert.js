"use client";

/** Reusable status alert */
export default function StatusAlert({ status, className = "" }) {
  const renderMessage = (msg) => {
    const parts = msg.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline font-medium">{part}</a>
        : part
    );
  };

  return (
    <div className={`p-2 rounded-md text-sm ${className} ${status.type === "success" ? "bg-success/10 text-success" :
        status.type === "warning" ? "bg-warning/10 text-warning" :
        status.type === "info" ? "bg-primary/10 text-primary" :
          "bg-danger/10 text-danger"
      }`}>
      {renderMessage(status.message)}
    </div>
  );
}
