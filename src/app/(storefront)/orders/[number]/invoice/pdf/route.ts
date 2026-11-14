import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatMoney } from "@/lib/money";
import { getAuthSession } from "@/server/auth/guard";
import {
  getOrderForAdminByNumber,
  getOrderForCustomer,
  getOrderForGuest,
} from "@/server/services/orders";
import { getStoreSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

/**
 * Standard PDF fonts only cover WinAnsi. Customer-entered names may be Arabic
 * or other scripts, so unsupported characters become "?" instead of throwing
 * mid-render. A future embedded Unicode font removes this limitation.
 */
function safe(text: string, font: PDFFont, size: number): string {
  let output = "";
  for (const char of text) {
    try {
      font.widthOfTextAtSize(char, size);
      output += char;
    } catch {
      output += "?";
    }
  }
  return output;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  const { number } = await params;
  const session = await getAuthSession();
  const token = new URL(request.url).searchParams.get("t");

  const order = token
    ? await getOrderForGuest(number, token)
    : session?.user.role === "admin"
      ? await getOrderForAdminByNumber(number)
      : session
        ? await getOrderForCustomer(number, session.user.id)
        : null;

  if (!order || !order.invoiceNumber) {
    return new Response("Not found", { status: 404 });
  }

  const settings = await getStoreSettings();
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 792;
  const left = 50;

  const write = (
    text: string,
    size = 10,
    font = regular,
    color = rgb(0.1, 0.1, 0.1),
  ) => {
    if (y < 50) {
      page = pdf.addPage([595, 842]);
      y = 792;
    }
    page.drawText(safe(text, font, size), { x: left, y, size, font, color });
    y -= size + 6;
  };

  const writeRight = (text: string, size = 10, font = regular) => {
    const encoded = safe(text, font, size);
    const width = font.widthOfTextAtSize(encoded, size);
    page.drawText(encoded, {
      x: 545 - width,
      y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  write(settings.legalName || settings.name, 16, bold);
  if (settings.address) write(settings.address, 9);
  if (settings.contactEmail) write(settings.contactEmail, 9);
  if (settings.trn) write(`TRN: ${settings.trn}`, 9);
  y -= 10;
  write("TAX INVOICE", 14, bold);
  write(`Invoice: ${order.invoiceNumber}`);
  write(`Order: ${order.number}`);
  write(`Date: ${order.placedAt.toISOString().slice(0, 10)}`);
  y -= 6;

  write("BILLED TO", 9, bold, rgb(0.4, 0.4, 0.4));
  write(order.email);
  write(order.shippingAddress.fullName);
  write(order.shippingAddress.phone);
  y -= 4;

  write("DELIVER TO", 9, bold, rgb(0.4, 0.4, 0.4));
  write(order.shippingAddress.building);
  write(order.shippingAddress.street);
  write(
    `${order.shippingAddress.area ? `${order.shippingAddress.area}, ` : ""}${order.shippingAddress.emirate}`,
  );
  y -= 8;

  write("ITEM", 9, bold, rgb(0.4, 0.4, 0.4));
  for (const item of order.items) {
    const title = item.title.length > 55 ? `${item.title.slice(0, 52)}...` : item.title;
    write(`${item.quantity} x ${title}`, 9);
    writeRight(formatMoney(item.lineTotalMinor), 9);
  }
  y -= 6;

  write(`Subtotal: ${formatMoney(order.subtotalMinor)}`);
  write(`Delivery: ${order.shippingMinor === 0 ? "Free" : formatMoney(order.shippingMinor)}`);
  if (order.discountMinor > 0) write(`Discount: -${formatMoney(order.discountMinor)}`);
  write(`VAT included: ${formatMoney(order.taxMinor)}`);
  if (order.refundedMinor > 0) write(`Refunded: ${formatMoney(order.refundedMinor)}`);
  write(`TOTAL: ${formatMoney(order.totalMinor)}`, 12, bold);

  write(
    "This invoice is issued for the order above. Keep it for your records.",
    8,
    regular,
    rgb(0.4, 0.4, 0.4),
  );

  const bytes = await pdf.save();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${order.invoiceNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
