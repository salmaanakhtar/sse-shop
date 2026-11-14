import { NextResponse } from "next/server";
import { unsubscribeNewsletter } from "@/server/services/marketing";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const unsubscribed = token ? await unsubscribeNewsletter(token) : false;
  const prefix = (request.headers.get("x-store-pathname") ?? "").startsWith("/ar") ? "/ar" : "";

  return NextResponse.redirect(
    new URL(`${prefix}/newsletter?unsubscribed=${unsubscribed ? "1" : "0"}`, request.url),
  );
}
