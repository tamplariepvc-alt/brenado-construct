import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Brenado Construct",
  description: "Aplicatie interna Brenado Construct",
  applicationName: "Brenado Construct",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Brenado Construct",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
