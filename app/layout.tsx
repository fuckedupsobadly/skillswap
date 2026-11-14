import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans } from "next/font/google";
import { GuestBootstrap } from "@/ui/guest-bootstrap";
import { Heartbeat } from "@/ui/heartbeat";
import { getViewer } from "./_lib/viewer";
import "./globals.css";

// §10.2: Pixelify Sans for names, labels and buttons; Inter for everything longer than one line.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-pixelify",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SkillSwap Village", template: "%s · SkillSwap Village" },
  description: "A small pixel village where you teach an hour, earn an hour, and learn anything from anyone.",
};

export const viewport: Viewport = { themeColor: "#fbf6ec" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <html lang="en" className={`${inter.variable} ${pixelify.variable}`}>
      <body className="min-h-dvh">
        <GuestBootstrap hasSession={Boolean(viewer)} />
        {viewer ? <Heartbeat /> : null}
        {children}
      </body>
    </html>
  );
}
