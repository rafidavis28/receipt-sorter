"use client";

import { useState, useCallback } from "react";
import {
  ParsedReceipt,
  ReceiptItem,
  SplitCategory,
  CATEGORY_CONFIG,
} from "@/lib/types";

type Step = "input" | "assign" | "summary";

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [assignments, setAssignments] = useState<
    Record<string, SplitCategory>
  >({});
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const handleParse = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (data.error && !data.receipt) {
        setError(data.error);
        return;
      }

      if (data.error && data.receipt?.items?.length === 0) {
        setError(data.error);
        return;
      }

      setReceipt(data.receipt);
      setAssignments({});
      setStep("assign");
    } catch {
      setError("שגיאה בחיבור לשרת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const assignCategory = useCallback(
    (itemId: string, category: SplitCategory) => {
      setAssignments((prev) => ({ ...prev, [itemId]: category }));
      setActiveItemId(null);
    },
    []
  );

  const allAssigned =
    receipt?.items.every((item) => assignments[item.id]) ?? false;

  const categoryTotals = receipt
    ? getCategoryTotals(receipt.items, assignments)
    : {};

  const handleReset = useCallback(() => {
    setStep("input");
    setUrl("");
    setReceipt(null);
    setAssignments({});
    setActiveItemId(null);
    setError(null);
  }, []);

  const summaryText = allAssigned
    ? formatSummary(receipt!, categoryTotals)
    : "";

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6 pb-32">
      {/* Header */}
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🧾 מיון קבלות</h1>
        <p className="text-sm text-gray-500 mt-1">Receipt Sorter</p>
      </header>

      {/* Step 1: Input */}
      {step === "input" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              הדבק קישור לקבלה דיגיטלית
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleParse()}
              placeholder="https://digi.rami-levy.co.il/..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              dir="ltr"
              autoFocus
            />
          </div>

          <button
            onClick={handleParse}
            disabled={loading || !url.trim()}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                טוען קבלה...
              </span>
            ) : (
              "טען קבלה"
            )}
          </button>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="text-xs text-gray-400 text-center space-y-1 mt-6">
            <p>נתמכים: רמי לוי · קרפור · אושר עד · שופרסל</p>
          </div>
        </div>
      )}

      {/* Step 2: Assign categories */}
      {step === "assign" && receipt && (
        <div>
          {/* Receipt header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">{receipt.store}</h2>
              {receipt.date && (
                <p className="text-xs text-gray-500">{receipt.date}</p>
              )}
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">₪{receipt.total.toFixed(2)}</p>
              <p className="text-xs text-gray-500">
                {receipt.items.length} פריטים
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>
                {Object.keys(assignments).length} / {receipt.items.length}{" "}
                מוקצים
              </span>
              {allAssigned && (
                <span className="text-green-600 font-medium">הכל מוקצה ✓</span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(Object.keys(assignments).length / receipt.items.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {receipt.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                category={assignments[item.id]}
                isActive={activeItemId === item.id}
                onTap={() =>
                  setActiveItemId(
                    activeItemId === item.id ? null : item.id
                  )
                }
                onAssign={(cat) => assignCategory(item.id, cat)}
              />
            ))}
          </div>

          {/* Bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
            <div className="max-w-lg mx-auto flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm"
              >
                חזור
              </button>
              <button
                onClick={() => setStep("summary")}
                disabled={!allAssigned}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium text-base disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-700 transition-colors"
              >
                {allAssigned
                  ? "הצג סיכום"
                  : `חסרים ${receipt.items.length - Object.keys(assignments).length} פריטים`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === "summary" && receipt && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">סיכום חלוקה</h2>
            <p className="text-lg font-bold">₪{receipt.total.toFixed(2)}</p>
          </div>

          <div className="space-y-3">
            {Object.entries(categoryTotals)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([cat, data]) => {
                const config = CATEGORY_CONFIG[cat as SplitCategory];
                return (
                  <div
                    key={cat}
                    className={`p-4 rounded-xl border ${config.border} ${config.bg}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`font-semibold ${config.color}`}>
                        {config.label}
                      </span>
                      <span className={`text-lg font-bold ${config.color}`}>
                        ₪{data.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {data.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm text-gray-600"
                        >
                          <span>{item.name}</span>
                          <span dir="ltr">₪{item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Copy & Reset */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
            <div className="max-w-lg mx-auto flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm"
              >
                קבלה חדשה
              </button>
              <button
                onClick={() => setStep("assign")}
                className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm"
              >
                חזור לעריכה
              </button>
              <CopyButton text={summaryText} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  category,
  isActive,
  onTap,
  onAssign,
}: {
  item: ReceiptItem;
  category?: SplitCategory;
  isActive: boolean;
  onTap: () => void;
  onAssign: (cat: SplitCategory) => void;
}) {
  const config = category ? CATEGORY_CONFIG[category] : null;

  return (
    <div>
      <button
        onClick={onTap}
        className={`w-full text-right p-3 rounded-xl border transition-all ${
          config
            ? `${config.bg} ${config.border}`
            : "bg-white border-gray-200"
        } ${isActive ? "ring-2 ring-blue-400" : ""}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{item.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.quantity > 1 && (
                <span className="text-xs text-gray-500">
                  {item.quantity} יח&apos;
                </span>
              )}
              {item.discount && item.discount > 0 && (
                <span className="text-xs text-red-500">
                  הנחה ₪{item.discount.toFixed(2)}-
                </span>
              )}
              {config && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color} ${config.border} border`}
                >
                  {config.label}
                </span>
              )}
            </div>
          </div>
          <span className="text-base font-semibold text-gray-900 mr-3" dir="ltr">
            ₪{item.total.toFixed(2)}
          </span>
        </div>
      </button>

      {/* Category picker */}
      {isActive && (
        <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CATEGORY_CONFIG) as SplitCategory[]).map((cat) => {
              const c = CATEGORY_CONFIG[cat];
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onAssign(cat)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? `${c.bg} ${c.color} ${c.border} ring-2 ring-offset-1 ring-current`
                      : `bg-white border-gray-200 text-gray-600 hover:${c.bg}`
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium text-base active:bg-blue-700 transition-colors"
    >
      {copied ? "הועתק! ✓" : "העתק סיכום"}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function getCategoryTotals(
  items: ReceiptItem[],
  assignments: Record<string, SplitCategory>
): Record<string, { total: number; items: ReceiptItem[] }> {
  const totals: Record<string, { total: number; items: ReceiptItem[] }> = {};

  for (const item of items) {
    const cat = assignments[item.id];
    if (!cat) continue;

    if (!totals[cat]) {
      totals[cat] = { total: 0, items: [] };
    }
    totals[cat].total += item.total;
    totals[cat].items.push(item);
  }

  return totals;
}

function formatSummary(
  receipt: ParsedReceipt,
  categoryTotals: Record<string, { total: number; items: ReceiptItem[] }>
): string {
  const lines: string[] = [];
  lines.push(`${receipt.store} | ${receipt.date || ""}`);
  lines.push(`סה״כ: ₪${receipt.total.toFixed(2)}`);
  lines.push("---");

  for (const [cat, data] of Object.entries(categoryTotals).sort(
    ([, a], [, b]) => b.total - a.total
  )) {
    const config = CATEGORY_CONFIG[cat as SplitCategory];
    lines.push(`${config.label}: ₪${data.total.toFixed(2)}`);
    for (const item of data.items) {
      lines.push(`  ${item.name} — ₪${item.total.toFixed(2)}`);
    }
  }

  return lines.join("\n");
}
