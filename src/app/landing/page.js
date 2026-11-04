"use client";
import { useRouter } from "next/navigation";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="relative overflow-x-hidden bg-bg font-sans text-text-main antialiased">
      <div className="relative z-10">
        <Navigation />

        <main>
          {/* Hero with Flow Animation */}
          <div className="relative">
          <HeroSection />
          <div className="flex justify-center pb-20">
            <FlowAnimation />
          </div>
        </div>

        <GetStarted />
        <HowItWorks />
        <Features />

        {/* CTA Section */}
        <section className="border-t border-border-subtle px-6 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-3xl font-semibold tracking-tight md:text-4xl">Route requests through one local endpoint</h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-text-muted">
              Configure providers once, then connect your client tools to MiawRouter.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="h-12 w-full rounded-md bg-primary px-8 text-base font-semibold text-white transition-colors hover:bg-brand-600 sm:w-auto"
              >
                Open dashboard
              </button>
              <button
                onClick={() => window.open("https://miawrouter.web.id", "_blank")}
                className="h-12 w-full rounded-md border border-border bg-surface px-8 text-base font-semibold transition-colors hover:bg-surface-2 sm:w-auto"
              >
                Read Documentation
              </button>
            </div>
          </div>
        </section>
        </main>

        <Footer />
      </div>


    </div>
  );
}
