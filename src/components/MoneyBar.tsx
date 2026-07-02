"use client";

import type { MoneyPipeline } from "@/lib/types";
import { pct } from "@/lib/domain";

// 3層バー: 見込み(cyan) / 内諾込み(pink) / 確定(green)
export default function MoneyBar({ money, goal }: { money: MoneyPipeline; goal: number }) {
  return (
    <div className="mtrack">
      <i style={{ left: 0, width: `${pct(money.weighted, goal)}%`, background: "var(--cyan)", opacity: 0.5 }} />
      <i style={{ left: 0, width: `${pct(money.withSoft, goal)}%`, background: "var(--pink)" }} />
      <i style={{ left: 0, width: `${pct(money.fixed, goal)}%`, background: "var(--green)" }} />
    </div>
  );
}
