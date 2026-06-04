import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EIGG Prevent",
  description: "Evidence your fraud prevention framework — failure to prevent fraud (ECCTA 2023).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="antialiased text-[14px]">{children}</body>
    </html>
  );
}
