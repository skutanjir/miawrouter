"use client";

import PropTypes from "prop-types";
import ThemeToggle from "../ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col relative bg-bg transition-colors duration-500 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Keep the authentication surface calm and aligned with Switchboard's palette. */}

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle variant="card" />
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 z-10 w-full h-full">
        {children}
      </main>
    </div>
  );
}

AuthLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
