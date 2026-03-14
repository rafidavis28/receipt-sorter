import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/parsers/detect";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "נא להזין קישור לקבלה" },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "קישור לא תקין" },
        { status: 400 }
      );
    }

    const receipt = await parseReceipt(url.trim());

    if (receipt.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "לא נמצאו פריטים בקבלה. נסה להדביק את תוכן הקבלה ישירות.",
          receipt,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ receipt });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "שגיאה בעיבוד הקבלה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
