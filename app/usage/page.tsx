"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "../components/Icon";
import AppRail from "../components/AppRail";

interface BookUsage {
  bookId: string | null;
  title: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  count: number;
}
interface ModelUsage {
  model: string;
  costUsd: number;
  count: number;
}
interface DayUsage {
  day: string;
  costUsd: number;
}
interface Budget {
  dayUsd: number;
  monthUsd: number;
  /** Zero means the window is uncapped. */
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
}
interface UsageSummary {
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  chatCount: number;
  byBook: BookUsage[];
  byModel: ModelUsage[];
  byDay: DayUsage[];
  budget?: Budget;
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: "1rem 1.1rem", flex: "1 1 150px" }}>
      <div style={{ color: "var(--muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: "0.2rem", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--faint)", fontSize: "0.8rem", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

/**
 * Spend against a ceiling: a bounded meter, not a chart. The state is always
 * spelled out in words next to the bar — colour alone never carries it.
 */
function BudgetMeter({ label, spent, limit, resets }: { label: string; spent: number; limit: number; resets: string }) {
  // Budgets are dollar-scale, unlike the fraction-of-a-cent per-question costs.
  const dollars = (n: number) => `$${n.toFixed(2)}`;
  const ratio = limit > 0 ? spent / limit : 0;
  const state =
    ratio >= 1
      ? { color: "var(--danger-strong)", word: "Budget reached" }
      : ratio >= 0.75
        ? { color: "var(--warn)", word: "Running low" }
        : { color: "var(--ok)", word: `${dollars(Math.max(0, limit - spent))} left` };

  return (
    <div style={{ flex: "1 1 220px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{label}</span>
        <span style={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
          {dollars(spent)} <span style={{ color: "var(--faint)" }}>of {dollars(limit)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={Number(spent.toFixed(4))}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${dollars(spent)} of ${dollars(limit)} used`}
        style={{ height: 6, background: "var(--border)", borderRadius: 3, marginTop: "0.4rem", overflow: "hidden" }}
      >
        <div style={{ height: "100%", width: `${Math.min(100, ratio * 100)}%`, background: state.color, borderRadius: 3 }} />
      </div>
      <div style={{ color: "var(--faint)", fontSize: "0.72rem", marginTop: "0.3rem" }}>
        {/* The reassurance only matters once you're near the ceiling. */}
        {state.word}
        {ratio >= 0.75 && ` · frees up as usage ages past ${resets}`}
      </div>
    </div>
  );
}

export default function UsagePage() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`failed (${r.status})`))))
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  const maxBookCost = data ? Math.max(...data.byBook.map((b) => b.costUsd), 0) : 0;
  const maxDayCost = data ? Math.max(...data.byDay.map((d) => d.costUsd), 0) : 0;

  return (
    <div className="rail-layout">
      <AppRail />
    <main className="page-pad">
      <header className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Usage &amp; cost</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-600)" }}>
            What reading with a companion has actually cost.
          </p>
        </div>
      </header>

      {!loaded && (
        <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 92, flex: "1 1 150px" }} />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--danger)", marginTop: "1.5rem" }}>
          Couldn&apos;t load usage: {error}
        </p>
      )}

      {loaded && data && data.chatCount === 0 && (
        <div className="card" style={{ marginTop: "1.5rem", padding: "2rem 1rem", textAlign: "center", color: "var(--muted)", borderStyle: "dashed" }}>
          <p style={{ margin: 0, fontSize: "1.4rem" }}><Icon name="chart" /></p>
          <p style={{ margin: "0.5rem 0 0" }}>No usage yet — ask the companion a question and your cost breakdown will appear here.</p>
        </div>
      )}

      {loaded && data && data.chatCount > 0 && (
        <>
          <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <Tile label="Total cost" value={usd(data.totalCostUsd)} sub={`${data.chatCount} question${data.chatCount === 1 ? "" : "s"}`} />
            <Tile label="Tokens in" value={compact(data.totalTokensIn)} />
            <Tile label="Tokens out" value={compact(data.totalTokensOut)} />
            <Tile label="Avg / question" value={usd(data.totalCostUsd / data.chatCount)} />
          </div>

          {data.budget && (data.budget.dailyLimitUsd > 0 || data.budget.monthlyLimitUsd > 0) && (
            <section style={{ marginTop: "2rem" }}>
              <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                Budget
              </h2>
              <div className="card" style={{ padding: "1rem 1.1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                {data.budget.dailyLimitUsd > 0 && (
                  <BudgetMeter label="Last 24 hours" spent={data.budget.dayUsd} limit={data.budget.dailyLimitUsd} resets="24 hours" />
                )}
                {data.budget.monthlyLimitUsd > 0 && (
                  <BudgetMeter label="Last 30 days" spent={data.budget.monthUsd} limit={data.budget.monthlyLimitUsd} resets="30 days" />
                )}
              </div>
            </section>
          )}

          {data.byDay.length > 1 && (
            <section style={{ marginTop: "2rem" }}>
              <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                Daily spend
              </h2>
              <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
                {data.byDay.map((d) => (
                  <div key={d.day} title={`${d.day}: ${usd(d.costUsd)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div
                      style={{
                        height: `${maxDayCost ? Math.max(3, (d.costUsd / maxDayCost) * 100) : 3}%`,
                        background: "var(--accent)",
                        borderRadius: "3px 3px 0 0",
                        minHeight: 3,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--faint)", fontSize: "0.72rem", marginTop: "0.35rem" }}>
                <span>{data.byDay[0]!.day}</span>
                <span>{data.byDay[data.byDay.length - 1]!.day}</span>
              </div>
            </section>
          )}

          <section style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              By book
            </h2>
            <div className="card" style={{ padding: "0.5rem 0.25rem" }}>
              {data.byBook.map((b) => (
                <div key={b.bookId ?? "unattributed"} style={{ padding: "0.55rem 0.85rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                    <div style={{ height: 5, background: "var(--border)", borderRadius: 3, marginTop: "0.35rem" }}>
                      <div style={{ height: "100%", width: `${maxBookCost ? (b.costUsd / maxBookCost) * 100 : 0}%`, background: "var(--accent)", borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{usd(b.costUsd)}</div>
                    <div style={{ color: "var(--faint)", fontSize: "0.75rem" }}>{b.count} Q · {compact(b.tokensIn + b.tokensOut)} tok</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 0.75rem" }}>
              By model
            </h2>
            <div className="card" style={{ padding: "0.5rem 0.25rem" }}>
              {data.byModel.map((m) => (
                <div key={m.model} style={{ padding: "0.5rem 0.85rem", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.model}</span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {usd(m.costUsd)} <span style={{ color: "var(--faint)", fontSize: "0.78rem" }}>· {m.count} Q</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      </main>
    </div>
  );
}
