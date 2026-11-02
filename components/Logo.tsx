import Image from "next/image";
import Link from "next/link";

/** The Project Y2K26 logo. Replaces the text wordmark everywhere (header, footer, admin). */
export function Logo({ className = "", size = 44, tag }: { plain?: boolean; className?: string; size?: number; tag?: string }) {
  return (
    <Link href="/" aria-label="Project Y2K26, home" className={`inline-flex min-h-11 items-center gap-2.5 ${className}`}>
      <Image src="/images/y2k26-logo-sm.webp" alt="Project Y2K26" width={240} height={185} priority style={{ height: size, width: "auto" }} />
      {tag && <span className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.18em] text-crimson">{tag}</span>}
    </Link>
  );
}
