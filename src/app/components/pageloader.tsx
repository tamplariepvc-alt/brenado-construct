"use client";

import Image from "next/image";

type PageLoaderProps = {
  message?: string;
};

export default function PageLoader({ message = "Se încarcă..." }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F0EEE9]">
      {/* Header identic cu restul aplicatiei */}
      <header className="border-b border-[#E8E5DE] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={44}
            className="h-10 w-auto object-contain sm:h-11"
          />
        </div>
      </header>

      {/* Continut centrat */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-[22px] border border-[#E8E5DE] bg-white px-10 py-12 shadow-sm">
          {/* Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-7 w-7 text-blue-600"
            >
              <rect
                x="5"
                y="4"
                width="14"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 2v4M15 2v4M8 10h8M8 14h5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Spinner */}
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#E8E5DE] border-t-[#0196ff]" />

          {/* Text */}
          <div className="text-center">
            <p className="text-[15px] font-semibold text-gray-900">{message}</p>
            <p className="mt-1 text-sm text-gray-400">Așteptați câteva momente</p>
          </div>
        </div>
      </div>
    </div>
  );
}
