export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { parsePairzonUrl, pairzonApiUrl } from "@/lib/parsers/pairzon";
import { fetchPairzonReceiptEdge } from "@/lib/parsers/pairzon-edge";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "נא להזין קישור לקבלה" }, { status: 400 });
    }

    const pairzon = parsePairzonUrl(url.trim());
    if (!pairzon) {
      return NextResponse.json({ error: "קישור לא תקין לקרפור/אושר עד" }, { status: 400 });
    }

    const apiUrl = pairzonApiUrl(pairzon.subdomain, pairzon.id, pairzon.p);

    try {
      const receipt = await fetchPairzonReceiptEdge(pairzon.subdomain, pairzon.id, pairzon.p);
      if (receipt.items.length === 0) {
        return NextResponse.json({ error: "לא נמצאו פריטים בקבלה.", receipt }, { status: 200 });
      }
      return NextResponse.json({ receipt });
    } catch {
      // Server is blocked from reaching Pairzon — return the API URL so
      // the client can guide the user to fetch it manually from their browser.
      return NextResponse.json(
        {
          error: "pairzon_blocked",
          apiUrl,
          subdomain: pairzon.subdomain,
        },
        { status: 200 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה בעיבוד הקבלה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
