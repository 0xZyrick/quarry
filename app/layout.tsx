import "./globals.css";
import type { Metadata } from "next";
import { OnboardingProvider } from "@/features/onboarding/OnboardingProvider";
import AnalyticsProvider from "@/features/analytics/AnalyticsProvider";

export const metadata: Metadata = {
  title: "Wippo",
  description: "Follow what people are building",
  icons: { icon: "/brand/wippo-icon.png", apple: "/brand/wippo-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--page)] text-[var(--ink)] antialiased">
        <OnboardingProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </OnboardingProvider>
      </body>
    </html>
  );
}
