import Link from "next/link";

// themed 404 instead of the framework default
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl font-bold text-slate-300">404</div>
      <p className="text-slate-600">Halaman tidak ditemukan atau kamu tidak punya akses.</p>
      <Link href="/boards" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Ke board saya
      </Link>
    </div>
  );
}
