import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/lib/contexts/LanguageContext";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: "PavelKnox Layered Knowledge",
  description: "AI Knowledge Pipeline",
};

import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { FloatingChat } from "@/components/chat/FloatingChat";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 selection:bg-indigo-500/30 font-sans relative overflow-x-hidden transition-colors duration-300">
        <LanguageProvider>
          <ThemeProvider>
            {/* Deep mesh gradient background so glassmorphism has a canvas in both modes */}
            <div className="fixed inset-0 z-[-1] bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
              <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] opacity-10 dark:opacity-30 pointer-events-none transition-opacity duration-300" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.3) 0%, rgba(9,9,11,0) 70%)' }} />
            </div>
            <AuthProvider>
              <AppHeader />
              <main className="flex-1 flex flex-col w-full relative">
                {children}
              </main>
              <FloatingChat />
              <AppFooter />
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
