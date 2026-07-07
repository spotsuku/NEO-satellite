"use client";

// 九州全図モード（ボード起動時のヒーロー表示）。
// 展開中の県はクリックでその拠点の詳細へ。進捗（成立数/8）を水位で黒塗り表示。
// 未展開県（福岡・宮崎・鹿児島など）はグレーで描画し、拡張の余白を見せる。

import { useState } from "react";
import type { BaseView } from "@/lib/types";
import { KYUSHU_PATHS, KYUSHU_LABELS, KYUSHU_VIEW } from "@/lib/kyushuMap";

// 水位は県ごとの高さ基準（マップ全体基準だと北側の県に水位が届かない）
const BOUNDS: Record<string, { minY: number; maxY: number }> = {};
for (const [c, d] of Object.entries(KYUSHU_PATHS)) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < nums.length; i += 2) {
    if (nums[i] < minY) minY = nums[i];
    if (nums[i] > maxY) maxY = nums[i];
  }
  BOUNDS[c] = { minY, maxY };
}

export default function KyushuMap({
  bases,
  onSelectBase,
}: {
  bases: BaseView[];
  onSelectBase: (code: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const baseByCode = new Map(bases.map((b) => [b.code, b]));
  const codes = Object.keys(KYUSHU_PATHS);
  // 未展開を先に描き、展開中の県を上に重ねる
  const inactive = codes.filter((c) => !baseByCode.has(c));
  const active = codes.filter((c) => baseByCode.has(c));

  return (
    <svg
      viewBox={`-2 -2 ${KYUSHU_VIEW.w + 4} ${KYUSHU_VIEW.h + 4}`}
      style={{ display: "block", margin: "0 auto", height: 440, maxWidth: "100%" }}
      role="img"
      aria-label="九州の拠点マップ"
    >
      {inactive.map((c) => (
        <g key={c}>
          <path
            d={KYUSHU_PATHS[c]}
            fill="#FAFAF7"
            stroke="var(--lgray)"
            strokeWidth={0.35}
            strokeLinejoin="round"
          />
          <text
            x={KYUSHU_LABELS[c].x}
            y={KYUSHU_LABELS[c].y}
            textAnchor="middle"
            fontSize={3.4}
            fill="var(--lgray)"
            fontFamily="'Noto Sans JP', sans-serif"
          >
            {KYUSHU_LABELS[c].ja}
          </text>
        </g>
      ))}

      {active.map((c) => {
        const b = baseByCode.get(c)!;
        const prog = b.done / b.triggersTotal;
        const lb = KYUSHU_LABELS[c];
        const isHover = hover === c;
        const warn = b.daysLeft !== null && b.daysLeft <= 30;
        return (
          <g
            key={c}
            data-code={c}
            style={{ cursor: "pointer" }}
            onClick={() => onSelectBase(c)}
            onMouseEnter={() => setHover(c)}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <clipPath id={`ky-${c}`}>
                <path d={KYUSHU_PATHS[c]} />
              </clipPath>
            </defs>
            <path
              d={KYUSHU_PATHS[c]}
              fill="#F4F4F1"
              stroke="var(--ink)"
              strokeWidth={isHover ? 1.1 : 0.6}
              strokeLinejoin="round"
            />
            {/* 進捗の水位（県の高さ基準で下から黒塗り + ピンク水位線） */}
            <g clipPath={`url(#ky-${c})`}>
              {(() => {
                const bd = BOUNDS[c];
                const level = bd.minY + (bd.maxY - bd.minY) * (1 - prog);
                return (
                  <>
                    <rect
                      x={-2}
                      y={level}
                      width={KYUSHU_VIEW.w + 4}
                      height={bd.maxY - level + 2}
                      fill="var(--ink)"
                    />
                    {prog > 0 && (
                      <rect
                        x={-2}
                        y={level - 0.9}
                        width={KYUSHU_VIEW.w + 4}
                        height={0.9}
                        fill="var(--pink)"
                      />
                    )}
                  </>
                );
              })()}
            </g>
            {/* ラベル（県名 + 成立数） */}
            <text
              x={lb.x}
              y={lb.y - 0.6}
              textAnchor="middle"
              fontSize={4.4}
              fontWeight={700}
              fill="var(--ink)"
              stroke="var(--paper)"
              strokeWidth={0.9}
              paintOrder="stroke"
              fontFamily="'Noto Sans JP', sans-serif"
            >
              {lb.ja}
            </text>
            <text
              x={lb.x}
              y={lb.y + 4.2}
              textAnchor="middle"
              fontSize={3.4}
              fontWeight={800}
              fill={warn ? "var(--red)" : "var(--ink)"}
              stroke="var(--paper)"
              strokeWidth={0.8}
              paintOrder="stroke"
              fontFamily="'Montserrat', 'Noto Sans JP', sans-serif"
            >
              {b.done}/{b.triggersTotal}
            </text>
          </g>
        );
      })}

      {/* ホバー中の案内はラベルと重ならないよう下部固定で表示 */}
      {hover && baseByCode.has(hover) && (
        <text
          x={KYUSHU_VIEW.w / 2}
          y={KYUSHU_VIEW.h + 0.5}
          textAnchor="middle"
          fontSize={3.2}
          fontWeight={700}
          fill="var(--ink)"
          stroke="var(--paper)"
          strokeWidth={0.8}
          paintOrder="stroke"
          fontFamily="'Noto Sans JP', sans-serif"
          pointerEvents="none"
        >
          {KYUSHU_LABELS[hover].ja}：クリックで詳細へ ▸ 次は {baseByCode.get(hover)!.next.code}
        </text>
      )}
    </svg>
  );
}
