import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mamma Moves",
  description: "Din alldeles egna träningsapp.",
  applicationName: "Mamma Moves",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mamma Moves",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8f2634"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
