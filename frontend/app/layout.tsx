import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "EIGG PREVENT",
  description: "Evidence your reasonable procedures under ECCTA 2023. AI gap analysis, board governance, one-click evidence pack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="antialiased text-[14px]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
