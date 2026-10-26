import { CalmShell } from "@/components/CalmShell";
import { SiteFooter } from "@/components/SiteFooter";

export function PolicyPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <CalmShell back={{ href: "/", label: "Home" }} width="max-w-[720px]">
        <article className="mt-7">
          <h1 className="text-[28px] leading-[1.15]">{title}</h1>
          {intro && <p className="muted mt-2">{intro}</p>}
          <div className="policy mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:border-b [&_a]:border-blood">
            {children}
          </div>
        </article>
      </CalmShell>
      <SiteFooter />
    </>
  );
}
