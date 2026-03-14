import * as cheerio from "cheerio";
import { ParsedReceipt, ReceiptItem } from "../types";

export function isShufersalUrl(url: string): boolean {
  return url.includes("invoice.shufersal.co.il");
}

async function fetchPage(url: string): Promise<string> {
  // Try native fetch first, fall back to curl for environments
  // where TLS fingerprinting blocks Node's requests
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    // Fallback to curl (works locally, may not work on all serverless platforms)
    try {
      const { execSync } = await import("child_process");
      return execSync(`curl -s -L --max-time 15 "${url}"`, {
        encoding: "utf-8",
        maxBuffer: 5 * 1024 * 1024,
      });
    } catch {
      throw new Error("לא ניתן לטעון את הדף משופרסל.");
    }
  }
}

export async function fetchShufersalReceipt(
  url: string
): Promise<ParsedReceipt> {
  // Step 1: Fetch the main page to extract the presigned S3 URL
  const html = await fetchPage(url);

  // Extract the PresignedURL from embedded JSON
  const presignedMatch = html.match(
    /"PresignedURL"\s*:\s*"(https:\/\/s3[^"]+)"/
  );
  const presignedMatch2 = html.match(
    /PresignedURL&quot;:&quot;(https:\/\/s3[^&]+(?:&amp;[^&]+)*)/
  );

  let presignedUrl = presignedMatch?.[1] || presignedMatch2?.[1];

  if (!presignedUrl) {
    throw new Error(
      "לא ניתן לחלץ את קישור הקבלה משופרסל. ייתכן שהקישור לא תקין."
    );
  }

  presignedUrl = presignedUrl
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  // Step 2: Fetch the actual receipt HTML from S3
  const receiptHtml = await fetchPage(presignedUrl);

  const totalMatch = html.match(/"InvoiceTotal"\s*:\s*([\d.]+)/);
  const fallbackTotal = totalMatch ? parseFloat(totalMatch[1]) : 0;

  return parseShufersalReceiptHtml(receiptHtml, fallbackTotal);
}

function parseShufersalReceiptHtml(
  rawHtml: string,
  fallbackTotal: number
): ParsedReceipt {
  // Strip XML declaration which can confuse cheerio with utf-16 encoding
  const html = rawHtml.replace(/<\?xml[^?]*\?>/i, "");
  const $ = cheerio.load(html);

  // The S3 receipt is a table where each row is duplicated.
  // Extract unique text lines by taking every other row
  const allRows = $("tr");
  const lines: string[] = [];
  allRows.each((i, el) => {
    if (i % 2 === 0) {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text) lines.push(text);
    }
  });


  const items: ReceiptItem[] = [];
  let idx = 0;
  let currentItem: ReceiptItem | null = null;
  let totalDiscount = 0;
  let inItems = false;

  for (const line of lines) {
    // Start parsing after the header line
    if (!inItems) {
      if (line.includes("קוד") && line.includes("תאור") && line.includes("לתשלום")) {
        inItems = true;
      }
      continue;
    }

    // Stop parsing at the end separator (only after items started)
    if (line.startsWith("--------") || line.includes("ל ת ש ל ו ם")) {
      if (currentItem) items.push(currentItem);
      currentItem = null;
      break;
    }

    // Discount row: ends with a number followed by "-"
    const discountMatch = line.match(/(\d+\.\d{2})-\s*$/);
    if (discountMatch && currentItem) {
      const amount = parseFloat(discountMatch[1]);
      currentItem.discount = (currentItem.discount || 0) + amount;
      currentItem.discountLabel = line
        .replace(discountMatch[0], "")
        .trim();
      currentItem.total =
        Math.round((currentItem.total - amount) * 100) / 100;
      totalDiscount += amount;
      continue;
    }

    // Detail row: contains "x" with quantity/weight info and final price
    // Formats: "5 x 8.90 ליחידה 44.50" or "0.135 ק"ג x 10.90 לק"ג 1.47"
    const detailMatch = line.match(
      /([\d.]+)\s*(?:ק"ג\s*)?(?:x|×)\s*([\d.]+)\s*(?:ליחידה|לק"ג|לקילו|לק)\s*([\d.]+)/
    );
    if (detailMatch && currentItem) {
      const qty = parseFloat(detailMatch[1]);
      const unitPrice = parseFloat(detailMatch[2]);
      const finalPrice = parseFloat(detailMatch[3]);
      currentItem.quantity = qty;
      currentItem.price = unitPrice;
      currentItem.total = finalPrice;
      continue;
    }

    // Item row: starts with a product code (digits), then name
    // Price may or may not be at end. We'll get the real price from the detail line.
    const itemMatch = line.match(/^(\d{4,13})\s+(.+?)\s*$/);
    if (itemMatch) {
      if (currentItem) items.push(currentItem);
      // Extract name, removing trailing price if present (e.g. "ברוקולי ארוז 9.90")
      let name = itemMatch[2].trim();
      let price = 0;
      const trailingPrice = name.match(/\s+([\d.]+)$/);
      if (trailingPrice) {
        price = parseFloat(trailingPrice[1]);
        name = name.replace(trailingPrice[0], "").trim();
      }
      currentItem = {
        id: `sf-${idx++}`,
        name,
        price,
        quantity: 1,
        total: price,
      };
      continue;
    }
  }

  // Extract total
  const text = $.text();
  const totalMatch = text.match(/סה"כ\s*שולם:\s*([\d.]+)/);
  const total = totalMatch ? parseFloat(totalMatch[1]) : fallbackTotal;

  // Extract date - look for the receipt transaction date (after "תאריך" or near end)
  const dateMatch =
    text.match(/תאריך[:\s]*(\d{2}\/\d{2}\/\d{2,4})/) ||
    text.match(/שעה[:\s]*\d{2}:\d{2}\s+(\d{2}\/\d{2}\/\d{2,4})/) ||
    text.match(/(\d{2}\/\d{2}\/\d{2,4})\s*$/);

  return {
    store: "שופרסל",
    date: dateMatch?.[0],
    items,
    total,
    totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
  };
}
