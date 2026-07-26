"use client";

import { useEffect, useState } from "react";
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
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : String(n);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/**
 * Spend against a ceiling: a bounded meter, not a chart.
 *
 * The bar's colour is the second signal. The state is always spelled out in
 * words underneath it, because marigold-at-75% means nothing to someone who
 * hasn't been told what marigold means here.
 */
function BudgetMeter({
  label,
  spent,
  limit,
  resets,
}: {
  label: string;
  spent: number;
  limit: number;
  resets: string;
}) {
  // Budgets are dollar-scale, unlike the fraction-of-a-cent per-question costs.
  const dollars = (n: number) => `$${n.toFixed(2)}`;
  const ratio = limit > 0 ? spent / limit : 0;
  const state = ratio >= 1 ? "over" : ratio >= 0.75 ? "low" : "ok";
  const word =
    state === "over"
      ? "Budget reached"
      : state === "low"
        ? "Running low"
        : `${dollars(Math.max(0, limit - spent))} left`;

  return (
    <div style={{ flex: "1 1 240px" }}>
      <div className="budget-row">
        <span style={{ color: "var(--text-600)" }}>{label}</span>
        <span>
          <b>{dollars(spent)}</b> <span style={{ color: "var(--text-800)" }}>of {dollars(limit)}</span>
        </span>
      </div>
      <div
        className="meter"
        data-state={state}
        role="meter"
        aria-valuenow={Number(spent.toFixed(4))}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${dollars(spent)} of ${dollars(limit)} used`}
      >
        <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <div className="budget-note" data-state={state}>
        {word}
        {/* The reassurance only matters once you're near the ceiling. */}
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
            <h1>Usage &amp; cost</h1>
            <p>What reading with a companion has actually cost — to the fraction of a cent.</p>
          </div>
        </header>

        {!loaded && (
          <div className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 98 }} />
            ))}
          </div>
        )}

        {error && (
          <p role="alert" style={{ color: "var(--danger)", marginTop: 22 }}>
            Couldn&apos;t load usage: {error}
          </p>
        )}

        {loaded && data && data.chatCount === 0 && (
          <div className="empty-state" style={{ marginTop: 22 }}>
            <Icon name="chart" size={26} />
            <p>
              No usage yet. Ask the companion a question and every token it spends will show up
              here, broken down by book, model and day.
            </p>
          </div>
        )}

        {loaded && data && data.chatCount > 0 && (
          <>
            <div className="stat-grid">
              <Stat
                label="Total cost"
                value={usd(data.totalCostUsd)}
                sub={`${data.chatCount} question${data.chatCount === 1 ? "" : "s"}`}
              />
              <Stat label="Avg / question" value={usd(data.totalCostUsd / data.chatCount)} />
              <Stat label="Tokens in" value={compact(data.totalTokensIn)} sub="passages + question" />
              <Stat label="Tokens out" value={compact(data.totalTokensOut)} sub="answers" />
            </div>

            {data.budget && (data.budget.dailyLimitUsd > 0 || data.budget.monthlyLimitUsd > 0) && (
              <section>
                <h2 className="section-label">Budget</h2>
                <div className="panel" style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
                  {data.budget.dailyLimitUsd > 0 && (
                    <BudgetMeter
                      label="Last 24 hours"
                      spent={data.budget.dayUsd}
                      limit={data.budget.dailyLimitUsd}
                      resets="24 hours"
                    />
                  )}
                  {data.budget.monthlyLimitUsd > 0 && (
                    <BudgetMeter
                      label="Last 30 days"
                      spent={data.budget.monthUsd}
                      limit={data.budget.monthlyLimitUsd}
                      resets="30 days"
                    />
                  )}
                </div>
              </section>
            )}

            {data.byDay.length > 1 && (
              <section>
                <h2 className="section-label">Daily spend</h2>
                <div className="panel">
                  <div className="spark">
                    {data.byDay.map((d) => (
                      <i
                        key={d.day}
                        title={`${d.day}: ${usd(d.costUsd)}`}
                        data-peak={maxDayCost > 0 && d.costUsd === maxDayCost}
                        style={{
                          height: `${maxDayCost ? Math.max(3, (d.costUsd / maxDayCost) * 100) : 3}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="spark-axis">
                    <span>{data.byDay[0]!.day}</span>
                    <span>{usd(maxDayCost)} on the busiest day</span>
                    <span>{data.byDay[data.byDay.length - 1]!.day}</span>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h2 className="section-label">By book</h2>
              <div className="panel" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {data.byBook.map((b) => (
                  <div key={b.bookId ?? "unattributed"} className="usage-row">
                    <div className="usage-row-main">
                      <div className="usage-row-title">{b.title}</div>
                      <div className="meter">
                        <span
                          style={{
                            width: `${maxBookCost ? (b.costUsd / maxBookCost) * 100 : 0}%`,
                            background: "var(--accent)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="usage-row-right">
                      <b>{usd(b.costUsd)}</b>
                      <span>
                        {b.count} Q · {compact(b.tokensIn + b.tokensOut)} tok
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="section-label">By model</h2>
              <div className="panel" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {data.byModel.map((m) => (
                  <div key={m.model} className="usage-row">
                    <div className="usage-row-main">
                      <div
                        className="usage-row-title"
                        style={{ color: "var(--text-600)", fontSize: 13 }}
                      >
                        {m.model}
                      </div>
                    </div>
                    <div className="usage-row-right">
                      <b>{usd(m.costUsd)}</b>
                      <span>{m.count} Q</span>
                    </div>
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
