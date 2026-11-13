import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetail, ORDER_STATUS_LABEL } from "@/components/storefront/order-detail";
import { buttonClass } from "@/components/ui/button";
import { requireUserPage } from "@/server/auth/guard";
import { getOrderForCustomer } from "@/server/services/orders";

export const metadata = { title: "Order details" };

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const session = await requireUserPage();
  const { number } = await params;

  const order = await getOrderForCustomer(number, session.user.id);
  if (!order) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{order.number}</h2>
          <p className="mt-1 text-sm text-muted">
            Placed{" "}
            {order.placedAt.toLocaleDateString("en-AE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <Link href="/account/orders" className={buttonClass("secondary", "sm")}>
          All orders
        </Link>
      </div>

      <OrderDetail order={order} />
    </div>
  );
}
