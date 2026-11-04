"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import Sidebar from "../Sidebar";
import Header from "../Header";

import { Icon } from "@/shared/components/Icon";
function getToastStyle(type) {
  if (type === "success") {
    return {
      wrapper: "border border-success/30 bg-success/10 text-success",
      icon: "check_circle",
    };
  }
  if (type === "error") {
    return {
      wrapper: "border border-danger/30 bg-danger/10 text-danger",
      icon: "error",
    };
  }
  if (type === "warning") {
    return {
      wrapper: "border border-warning/30 bg-warning/10 text-warning",
      icon: "warning",
    };
  }
  return {
    wrapper: "border border-primary/30 bg-primary/10 text-primary",
    icon: "info",
  };
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    globalThis.addEventListener("keydown", closeOnEscape);
    return () => globalThis.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-text-main">
      <div className="fixed top-4 right-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
        {notifications.map((n) => {
          const style = getToastStyle(n.type);
          return (
            <div
              key={n.id}
              className={`rounded-[10px] border px-3 py-2 shadow-elevated ${style.wrapper}`}
            >
              <div className="flex items-start gap-2">
                <Icon name={style.icon} className=" text-[18px] leading-5" />
                <div className="min-w-0 flex-1">
                  {n.title ? <p className="text-xs font-semibold mb-0.5">{n.title}</p> : null}
                  <p className="text-xs whitespace-pre-wrap break-words">{n.message}</p>
                </div>
                {n.dismissible ? (
                  <button
                    type="button"
                    onClick={() => removeNotification(n.id)}
                    className="text-current/70 hover:text-current"
                    aria-label="Dismiss notification"
                  >
                    <Icon name={"close"} className=" text-[16px]" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <div className="hidden lg:flex h-full shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar - Mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation"
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} forceExpanded />
      </div>

      {/* Main content */}
      <main inert={sidebarOpen} className="flex min-w-0 flex-1 flex-col isolate">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {(() => {
          const isChatPage = pathname === "/dashboard/basic-chat" || pathname === "/dashboard/playground";
          return (
            <div className={`dashboard-scroll flex-1 overflow-y-auto custom-scrollbar ${isChatPage ? "" : "p-4 lg:p-6"} ${isChatPage ? "flex flex-col overflow-hidden" : ""}`}>
              <div className={`dashboard-page-content ${isChatPage ? "w-full h-full flex flex-1 flex-col" : "mx-auto w-full max-w-[1280px]"}`}>{children}</div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
