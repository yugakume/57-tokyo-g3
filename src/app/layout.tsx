import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";
import { MeetingMinutesProvider } from "@/contexts/MeetingMinutesContext";
import { TaskProvider } from "@/contexts/TaskContext";
import { CountdownProvider } from "@/contexts/CountdownContext";
import { AppShell } from "@/components/Header";
import CustomCursor from "@/components/CustomCursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "支部ポータル | ドットジェイピー",
  description: "ドットジェイピー支部運営ポータルサイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <ScheduleProvider>
                <MeetingMinutesProvider>
                  <TaskProvider>
                    <CountdownProvider>
                      <AppShell>
                        {children}
                        <CustomCursor />
                      </AppShell>
                    </CountdownProvider>
                  </TaskProvider>
                </MeetingMinutesProvider>
              </ScheduleProvider>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
