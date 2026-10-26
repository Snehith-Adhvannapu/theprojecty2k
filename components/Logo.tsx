import Link from "next/link";

/** Chrome wordmark. Hero-adjacent only; trust screens use `plain`. */
export function Logo({ plain = false, className = "" }: { plain?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Project Y2K, home"
      className={`inline-flex min-h-11 items-center font-display text-[34px] leading-none tracking-[0.04em] ${plain ? "text-fg" : "chrome-text"} ${className}`}
    >
      Y2K
    </Link>
  );
}
