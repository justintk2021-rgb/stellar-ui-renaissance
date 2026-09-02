# Journal Bugs — Cursor Prompts

Paste each prompt block into Cursor (Cmd+L / Ctrl+L) one at a time. Each is self-contained.

---

## Bug 1 — Period filter uses UTC parsing, can include/exclude wrong trades at boundary

**File:** `src/components/Journal/TradeTable.tsx`
**Line:** ~736 (inside `filteredTrades` useMemo)

**Prompt:**
```
In src/components/Journal/TradeTable.tsx, the `filteredTrades` useMemo (around line 731) uses `new Date(t.date)` to compare against the period cutoff. Because `t.date` is a date-only string like "2025-04-07", JavaScript parses it as UTC midnight, which shifts the day in negative-UTC timezones and includes/excludes trades incorrectly at the cutoff boundary.

Fix: replace the `new Date(t.date)` parsing with the project's existing helpers. Use `getTradeLocalDateKey(t)` to get the local YYYY-MM-DD key, then `parseLocalDateKey(...)` to get a local Date for comparison against `cutoff`. Both helpers are already imported from `@/lib/tradeFormat` at the top of the file.

Skip trades where the key is missing/"Unknown" (treat as not matching). Keep the symbol filter logic unchanged.
```

---

## Bug 2 — Cumulative P&L chart doesn't sort trades chronologically

**File:** `src/components/Journal/TradeTable.tsx`
**Line:** ~200 (`AnimatedLineChart` component, the `cumulative` computation around line 214)

**Prompt:**
```
In src/components/Journal/TradeTable.tsx, the `AnimatedLineChart` component (around line 200) builds a cumulative P&L array directly from the `trades` prop in whatever order it received them. The trades come from `groupTradesByDate` which preserves insertion order, not chronological order, so the line chart can zig-zag instead of showing the day's actual progression.

Fix: before the `cumulative` reduce, create a sorted copy of trades by chronological order. Prefer `openTime` if present; otherwise fall back to `date`. Use the sorted array for the cumulative reduce and for the `gradientId` memo. Do not mutate the original `trades` prop.
```

---

## Bug 3 — `sortedDates` sort can return NaN when an "Unknown" bucket exists

**File:** `src/components/Journal/TradeTable.tsx`
**Line:** ~747 (`sortedDates` useMemo)

**Prompt:**
```
In src/components/Journal/TradeTable.tsx, `sortedDates` (around line 747) sorts date keys with `new Date(b).getTime() - new Date(a).getTime()`. `groupTradesByDate` can produce an "Unknown" bucket when a trade has no date, and `new Date("Unknown").getTime()` is NaN, which makes the comparator return NaN and the sort order undefined.

Fix: in the sort comparator, detect non-YYYY-MM-DD keys (e.g. "Unknown") and push them to the end of the list deterministically. For valid YYYY-MM-DD keys, keep the descending date sort, but use `parseLocalDateKey` from `@/lib/tradeFormat` instead of `new Date(...)` to match the rest of the file's local-date convention.
```

---

## Bug 4 — Virtualizer underestimates expanded row height

**File:** `src/components/Journal/TradeTable.tsx`
**Line:** ~757 (`useVirtualizer` call, `estimateSize`)

**Prompt:**
```
In src/components/Journal/TradeTable.tsx, the `useVirtualizer` call (around line 754) sets `estimateSize: (index) => (expandedDate === sortedDates[index] ? 280 : 72)`. The expanded row contains the metrics bar (chart + 6 metric cards) plus one row per trade (each row is ~80–110px tall and may include a broker time-and-duration pill row), so 280px is far too low. `measureElement` corrects after layout, but during the expand animation the scroll position jumps.

Fix: estimate the expanded size based on trade count. Use roughly `220` for the metrics bar plus `110 * groupedTrades[date].length` for the trade rows. Cap at a sensible max (e.g. 2000). Collapsed rows stay at 72.
```

---

## Bug 5 — Notes modal shows raw date string instead of formatted date

**File:** `src/components/Journal/TradeTable.tsx`
**Lines:** ~1031 and ~1143

**Prompt:**
```
In src/components/Journal/TradeTable.tsx, the notes modal renders the raw trade date string in two places:
  - around line 1031: `{dayTrades[0]?.date} • {dayTrades.length} trades`
  - around line 1143: `{selectedTrade.date}`

The rest of the file uses the local `formatDate` helper (defined around line 126) to format YYYY-MM-DD into a readable string like "Mon, Apr 07, 2025".

Fix: replace both raw `.date` references with `formatDate(...)`. If the date string is empty/undefined, fall back to "—" to avoid rendering "undefined".
```

---

## Optional follow-ups (not in scope of above)

- `dangerouslySetInnerHTML` at line ~1161 — confirm note content is sanitized upstream before storage. If not, sanitize with DOMPurify before injecting.
- `MiniCalendar.tsx` lines 41/51/55 — `useState(new Date())` should be lazy init, `pnlMap` should be `useMemo`. Performance only.
