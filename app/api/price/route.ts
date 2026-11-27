import { NextResponse } from "next/server";
import { getPrices } from "../../lib/server/coingecko";

export async function GET() {
  try {
    const prices = await getPrices();
    return NextResponse.json(prices, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Price unavailable" }, { status: 503 });
  }
}
