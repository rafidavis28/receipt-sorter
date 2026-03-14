export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  discount?: number;
  discountLabel?: string;
  category?: SplitCategory;
}

export interface ParsedReceipt {
  store: string;
  storeBranch?: string;
  date?: string;
  items: ReceiptItem[];
  total: number;
  totalDiscount?: number;
}

export type SplitCategory =
  | "me"
  | "sam"
  | "raphael"
  | "me+sam"
  | "me+raphael"
  | "sam+raphael"
  | "three-way"
  | "girlfriend"
  | "other";

export const CATEGORY_CONFIG: Record<
  SplitCategory,
  { label: string; labelHe: string; color: string; bg: string; border: string }
> = {
  me: {
    label: "Just Me",
    labelHe: "רק אני",
    color: "text-blue-700",
    bg: "bg-blue-100",
    border: "border-blue-300",
  },
  sam: {
    label: "Sam",
    labelHe: "סם",
    color: "text-green-700",
    bg: "bg-green-100",
    border: "border-green-300",
  },
  raphael: {
    label: "Raphael",
    labelHe: "רפאל",
    color: "text-orange-700",
    bg: "bg-orange-100",
    border: "border-orange-300",
  },
  "me+sam": {
    label: "Me + Sam",
    labelHe: "אני + סם",
    color: "text-teal-700",
    bg: "bg-teal-100",
    border: "border-teal-300",
  },
  "me+raphael": {
    label: "Me + Raphael",
    labelHe: "אני + רפאל",
    color: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-amber-300",
  },
  "sam+raphael": {
    label: "Sam + Raphael",
    labelHe: "סם + רפאל",
    color: "text-lime-700",
    bg: "bg-lime-100",
    border: "border-lime-300",
  },
  "three-way": {
    label: "Split 3-way",
    labelHe: "שלושה",
    color: "text-purple-700",
    bg: "bg-purple-100",
    border: "border-purple-300",
  },
  girlfriend: {
    label: "Girlfriend",
    labelHe: "חברה",
    color: "text-pink-700",
    bg: "bg-pink-100",
    border: "border-pink-300",
  },
  other: {
    label: "Other",
    labelHe: "אחר",
    color: "text-gray-700",
    bg: "bg-gray-100",
    border: "border-gray-300",
  },
};

export type Supermarket = "rami-levy" | "carrefour" | "osher-ad" | "shufersal";
