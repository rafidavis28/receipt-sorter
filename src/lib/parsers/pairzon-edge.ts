import { ParsedReceipt, ReceiptItem } from "../types";

interface PairzonItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  total: number;
  additionalInfo?: Array<{ key: string; value: string }>;
}

interface PairzonResponse {
  id: string;
  items: PairzonItem[];
  total: number;
  createdDate?: string;
  store?: { name?: string; alias?: string };
}

export async function fetchPairzonReceiptEdge(
  subdomain: string,
  id: string,
  p: string
): Promise<ParsedReceipt> {
  const apiUrl = `https://${subdomain}.pairzon.com/v1.0/documents/${id}?p=${p}`;
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

  if (!res.ok) {
    throw new Error(`שגיאה בטעינת הקבלה: ${res.status}`);
  }

  const data: PairzonResponse = await res.json();

  const storeName =
    subdomain === "osher"
      ? "אושר עד"
      : subdomain === "carrefour"
        ? "קרפור"
        : data.store?.alias || data.store?.name || subdomain;

  const items: ReceiptItem[] = data.items.map((item, idx) => {
    let discount = 0;
    let discountLabel: string | undefined;

    if (item.additionalInfo) {
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
