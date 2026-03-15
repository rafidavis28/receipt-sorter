import { ParsedReceipt, ReceiptItem } from "../types";

interface PairzonItem {
  id: string;
  index: number;
  name: string;
  code?: string;
  price: number;
  quantity?: number;
  total: number;
  weight?: number;
  additionalInfo?: Array<{ key: string; value: string }>;
  category?: string[];
}

interface PairzonResponse {
  id: string;
  items: PairzonItem[];
  total: number;
  totalNoVat?: number;
  totalVat?: number;
  vat?: number;
  numberOfItems?: number;
  createdDate?: string;
  store?: {
    name?: string;
    alias?: string;
    address?: string;
  };
}

export function parsePairzonUrl(url: string): {
  subdomain: string;
  id: string;
  p: string;
} | null {
  // Pattern: https://{subdomain}.pairzon.com/{templateId}.html?id={id}&p={p}
  const match = url.match(
    /https?:\/\/(\w+)\.pairzon\.com\/[\w-]+\.html\?id=([\w-]+)&p=(\d+)/
  );
  if (!match) return null;
  return { subdomain: match[1], id: match[2], p: match[3] };
}

async function fetchPairzonJson(apiUrl: string, subdomain: string): Promise<string> {
  const headers = [
    `-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"`,
    `-H "Accept: application/json, text/plain, */*"`,
    `-H "Accept-Language: he-IL,he;q=0.9,en;q=0.8"`,
    `-H "Referer: https://${subdomain}.pairzon.com/"`,
    `-H "Origin: https://${subdomain}.pairzon.com"`,
  ].join(" ");

  // Try native fetch first
  try {
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
        Referer: `https://${subdomain}.pairzon.com/`,
        Origin: `https://${subdomain}.pairzon.com`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    // Fallback to curl — different TLS fingerprint, bypasses bot detection
    const { execSync } = await import("child_process");
    try {
      return execSync(`curl -s -L -6 --max-time 15 ${headers} "${apiUrl}"`, {
        encoding: "utf-8",
        maxBuffer: 2 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (curlErr) {
      const err = curlErr as { stderr?: string; status?: number };
      throw new Error(`curl failed (exit ${err.status}): ${err.stderr || "no output"}`);
    }
  }
}

export async function fetchPairzonReceipt(
  subdomain: string,
  id: string,
  p: string
): Promise<ParsedReceipt> {
  const apiUrl = `https://${subdomain}.pairzon.com/v1.0/documents/${id}?p=${p}`;
  const body = await fetchPairzonJson(apiUrl, subdomain);
  const data: PairzonResponse = JSON.parse(body);
  return parsePairzonData(data, subdomain);
}

function parsePairzonData(
  data: PairzonResponse,
  subdomain: string
): ParsedReceipt {
  const storeName =
    subdomain === "osher"
      ? "אושר עד"
      : subdomain === "carrefour"
        ? "קרפור"
        : data.store?.alias || data.store?.name || subdomain;

  const items: ReceiptItem[] = data.items.map((item, idx) => {
    let discount = 0;
    let discountLabel: string | undefined;

    if (item.additionalInfo && item.additionalInfo.length > 0) {
      for (const info of item.additionalInfo) {
        const val = parseFloat(info.value);
        if (!isNaN(val) && val < 0) {
          discount += Math.abs(val);
          discountLabel = info.key;
        }
      }
    }

    return {
      id: item.id || `pairzon-${idx}`,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      total: item.total - discount,
      discount: discount > 0 ? discount : undefined,
      discountLabel,
    };
  });

  return {
    store: storeName,
    storeBranch: data.store?.name,
    date: data.createdDate
      ? new Date(data.createdDate).toLocaleDateString("he-IL")
      : undefined,
    items,
    total: data.total,
  };
}
