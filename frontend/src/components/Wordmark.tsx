import { Link } from "react-router-dom";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-baseline gap-0 font-semibold tracking-tight text-zinc-900 no-underline hover:opacity-90 ${className}`}
    >
      <span className="text-xl tracking-tight">useformly</span>
      <span className="text-lg font-medium text-violet-600">.ai</span>
    </Link>
  );
}
