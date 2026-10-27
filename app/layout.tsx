import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { Navbar } from "./components/Navbar";
import { getSessionUser } from "@/app/lib/auth";
import prisma from "@/app/lib/db";
import { env } from "@/app/lib/env";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const title = "Notekit — notes that organise themselves";
const description =
  "A fast, private notes app with markdown, tags, full-text search and AI summaries. Your notes stay yours.";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: title,
    template: "%s · Notekit",
  },
  description,
  applicationName: "Notekit",
  keywords: ["notes", "markdown", "knowledge base", "note taking", "AI notes"],
  openGraph: {
    type: "website",
    title,
    description,
    siteName: "Notekit",
    url: env.NEXT_PUBLIC_APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* The session and the user's colour scheme are read on every render. */
export const dynamic = "force-dynamic";

async function getColorScheme(userId: string) {
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: { colorScheme: true },
  });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  const data = await getColorScheme(user?.id ?? "");

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${
          data?.colorScheme ?? "theme-rose"
        } antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
