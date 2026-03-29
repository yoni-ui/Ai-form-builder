import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "./Wordmark";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Wordmark />
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link to="/dashboard" className="text-zinc-600 hover:text-zinc-900">
              Dashboard
            </Link>
            <Link to="/forms" className="text-zinc-600 hover:text-zinc-900">
              My forms
            </Link>
            <Link to="/login" className="text-violet-600 hover:text-violet-700">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-zinc-200/80 bg-white py-6 text-center text-sm text-zinc-500">
        <span className="text-zinc-400">Powered by </span>
        <span className="font-medium text-zinc-700">useformly.ai</span>
      </footer>
    </div>
  );
}
