import type { Metadata } from "next";
import Nav from "./Nav";
import "./globals.css";

export const metadata: Metadata = { title: "Sheet Leads", description: "Meta lead ads from Google Sheets" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
