import * as cheerio from "cheerio";
import { ParsedReceipt, ReceiptItem } from "../types";

export function isRamiLevyUrl(url: string): boolean {
  return url.includes("digi.rami-levy.co.il");
}

export async function fetchRamiLevyReceipt(
  url: string
): Promise<ParsedReceipt> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Rami Levy receipt: ${res.status}`);
  }
  const html = await res.text();
  return parseRamiLevyHtml(html);
}

// Nuxt devalue format: flat array where objects store indices as values
// e.g. data[5] = { name: 10, price: 12 } means name=data[10], price=data[12]
function resolveDevalue(data: unknown[], idx: number, depth = 0): unknown {
  if (depth > 10) return null; // prevent infinite recursion
  const val = data[idx];
  if (val === null || val === undefined) return val;
  if (typeof val !== "object") return val;

  // Handle devalue wrapper types like ["ShallowReactive", 1] or ["Reactive", 5]
  if (Array.isArray(val)) {
    if (
      val.length === 2 &&
      typeof val[0] === "string" &&
      (val[0] === "ShallowReactive" || val[0] === "Reactive")
    ) {
      return resolveDevalue(data, val[1] as number, depth + 1);
    }
    return val.map((v) =>
      typeof v === "number" ? resolveDevalue(data, v, depth + 1) : v
    );
  }

  // Regular object - resolve each value reference
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val)) {
    if (typeof v === "number") {
      obj[k] = resolveDevalue(data, v, depth + 1);
    } else {
      obj[k] = v;
    }
  }
  return obj;
}

interface RLItem {
  name?: string;
  price?: number;
  total?: number;
  quantity?: number;
  code?: string;
  weight?: number;
  additional_info?: Array<{ key?: string; value?: string }> | null;
}

interface RLReceipt {
  document_type?: string;
  branch?: { name?: string };
  created_at?: string;
  payments?: { total?: number; total_vat?: number };
  items?: RLItem[];
}

function parseRamiLevyHtml(html: string): ParsedReceipt {
  const $ = cheerio.load(html);

  // Extract the __NUXT_DATA__ JSON payload
  const nuxtDataScript = $("#__NUXT_DATA__").html();
  if (!nuxtDataScript) {
    throw new Error(
      "לא נמצא מידע בקבלה של רמי לוי. ייתכן שהקישור לא תקין."
    );
  }

  const data: unknown[] = JSON.parse(nuxtDataScript);

  // Find the receipt object: has document_type, items, payments keys
  let receiptIdx = -1;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      "document_type" in val &&
      "items" in val &&
      "payments" in val
    ) {
      receiptIdx = i;
      break;
    }
  }

  if (receiptIdx === -1) {
    throw new Error("לא נמצאו נתוני קבלה בדף של רמי לוי.");
  }

  const receipt = resolveDevalue(data, receiptIdx) as RLReceipt;

  // Parse items
  const items: ReceiptItem[] = (receipt.items || []).map(
    (item: RLItem, idx: number) => {
      let discount = 0;
      let discountLabel: string | undefined;

      if (item.additional_info && Array.isArray(item.additional_info)) {
        for (const info of item.additional_info) {
          if (info && info.value) {
            const val = parseFloat(info.value);
            if (!isNaN(val) && val < 0) {
              discount += Math.abs(val);
              discountLabel = info.key || undefined;
            }
          }
        }
      }

      const finalTotal = (item.total || 0) - discount;

      return {
        id: `rl-${idx}`,
        name: item.name || "",
        price: item.price || 0,
        quantity: item.quantity || 1,
        total: Math.round(finalTotal * 100) / 100,
        discount: discount > 0 ? discount : undefined,
        discountLabel,
      };
    }
  );

  const total = receipt.payments?.total || 0;
  const date = receipt.created_at
    ? new Date(receipt.created_at).toLocaleDateString("he-IL")
    : undefined;

  return {
    store: "רמי לוי",
    storeBranch: receipt.branch?.name,
    date,
    items,
    total,
  };
}
