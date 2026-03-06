import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const displayFont = Fraunces({
  variable: "--font-openrec-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodyFont = IBM_Plex_Sans({
  variable: "--font-openrec-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-openrec-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "OpenRec | Free open-source screen recorder and editor",
  description:
    "OpenRec is a free open-source desktop screen recorder and editor. Capture screen, window, camera, and mic, edit on a timeline, and export MP4 or GIF on macOS and Linux.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
