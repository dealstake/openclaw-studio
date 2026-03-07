import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ChunkErrorRecovery } from "@/components/ChunkErrorRecovery";
import "./globals.css";

export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Trident Control Center",
  description: "AI agent operations dashboard for Trident Funding Solutions.",
};

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
          }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased overflow-x-hidden`}>
        <ChunkErrorRecovery />
        {children}
        <Toaster
          theme="system"
          position="bottom-right"
          toastOptions={{
            className:
              "!bg-card !border-border !text-foreground !shadow-lg !animate-in !slide-in-from-right-5 !fade-in !duration-300",
          }}
        />
      </body>
    </html>
  );
}
