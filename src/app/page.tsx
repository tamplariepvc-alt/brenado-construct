import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Brenado Construct</h1>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-black px-5 py-3 text-white"
        >
          Mergi la login
        </Link>
      </div>
    </div>
  );
}