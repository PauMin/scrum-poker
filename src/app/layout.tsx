import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/components/UserContext";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "SprintPoker",
  description: "Gamified Agile Estimation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <UserProvider>
            <div className="app-container">
                <Header />
                <div className="main-content">
                    {children}
                </div>
            </div>
        </UserProvider>
      </body>
    </html>
  );
}