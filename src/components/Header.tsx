import Link from "next/link";
import { getAdminFromCookies } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export async function Header() {
  const isAdmin = await getAdminFromCookies();
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/60 bg-[#0b0b0f]/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight sm:text-lg"
        >
          <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            o mu bu mu?
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-[var(--muted)] hover:text-white"
              >
                Panel
              </Link>
              <Link
                href="/admin/new"
                className="btn btn-primary !px-4 !py-2 text-sm"
              >
                Yeni oyun
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-lg px-3 py-2 text-zinc-300 hover:bg-[var(--muted)] hover:text-white"
            >
              Giriş
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
