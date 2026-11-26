import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Public_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const display = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const bodyFont = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PortaGov - Citizens. Services. Connected.",
  description:
    "Apply for birth certificates, passports, police clearance and more from home. Pay by mobile money, track every step, and collect at your county centre or a Liberian embassy.",
  metadataBase: new URL("https://portagov-frontend.vercel.app"),
};

export const viewport: Viewport = {
  themeColor: "#0a2a5e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${bodyFont.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
