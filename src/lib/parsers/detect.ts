import { ParsedReceipt, Supermarket } from "../types";
import { parsePairzonUrl, fetchPairzonReceipt } from "./pairzon";
import { isRamiLevyUrl, fetchRamiLevyReceipt } from "./rami-levy";
import { isShufersalUrl, fetchShufersalReceipt } from "./shufersal";

export function detectSupermarket(url: string): Supermarket | null {
  if (isRamiLevyUrl(url)) return "rami-levy";
  if (isShufersalUrl(url)) return "shufersal";

  const pairzon = parsePairzonUrl(url);
  if (pairzon) {
    if (pairzon.subdomain === "carrefour") return "carrefour";
    if (pairzon.subdomain === "osher") return "osher-ad";
  }

  return null;
}

export async function parseReceipt(url: string): Promise<ParsedReceipt> {
  const supermarket = detectSupermarket(url);

  if (!supermarket) {
    throw new Error(
      "לא זוהה סופרמרקט. נתמכים: רמי לוי, קרפור, אושר עד, שופרסל"
    );
  }

  switch (supermarket) {
    case "rami-levy":
      return fetchRamiLevyReceipt(url);

    case "carrefour":
    case "osher-ad": {
      const pairzon = parsePairzonUrl(url)!;
      return fetchPairzonReceipt(pairzon.subdomain, pairzon.id, pairzon.p);
    }

    case "shufersal":
      return fetchShufersalReceipt(url);
  }
}
