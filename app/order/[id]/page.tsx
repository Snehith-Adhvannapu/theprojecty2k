import type { Metadata } from "next";
import { CalmShell } from "@/components/CalmShell";
import { OrderStatus } from "@/components/OrderStatus";
import { whatsappLink } from "@/lib/contact";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CalmShell right="Your order">
      <OrderStatus orderId={id} whatsapp={whatsappLink("Hi, I need help with my Project Y2K order")} />
    </CalmShell>
  );
}
