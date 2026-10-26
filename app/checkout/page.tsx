import type { Metadata } from "next";
import { Suspense } from "react";
import { CalmShell } from "@/components/CalmShell";
import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <CalmShell back={{ href: "/#passes", label: "Passes" }} right="Secure checkout">
      <Suspense fallback={<div className="skeleton mt-8 h-64" aria-busy="true" />}>
        <CheckoutForm />
      </Suspense>
    </CalmShell>
  );
}
