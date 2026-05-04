"use client";

import RealtimeToast from "@/components/RealtimeToast";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RealtimeToast />
      {children}
    </>
  );
}
