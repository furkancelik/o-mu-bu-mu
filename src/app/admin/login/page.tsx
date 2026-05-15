import { redirect } from "next/navigation";
import { getAdminFromCookies } from "@/lib/auth";
import { Header } from "@/components/Header";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getAdminFromCookies()) {
    redirect(next && next.startsWith("/") ? next : "/admin");
  }
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Panel girişi</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Yönetici parolasıyla giriş yap.
          </p>
          <LoginForm next={next && next.startsWith("/") ? next : "/admin"} />
        </div>
      </main>
    </>
  );
}
