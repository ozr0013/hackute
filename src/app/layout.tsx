import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Utah HackMatch",
  description: "Find a hackathon team at the University of Utah",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#be0000",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await getUser();

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-utah text-sm font-bold text-white">
                U
              </span>
              <span>HackMatch</span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              {user ? (
                <>
                  <Link href="/me" className="rounded-md px-3 py-2 hover:bg-zinc-100">
                    Me
                  </Link>
                  <form action={signOut}>
                    <button className="rounded-md px-3 py-2 text-zinc-500 hover:bg-zinc-100">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="rounded-md bg-utah px-3 py-2 font-medium text-white">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
