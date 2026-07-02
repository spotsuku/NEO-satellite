"use client";

import { useState } from "react";
import type { ActivityItem } from "@/lib/types";

const PAGE = 20;

export default function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = activities.slice(0, limit);

  return (
    <>
      <ul className="feed" id="feedlist">
        {shown.map((f) => (
          <li key={f.id} className={f.isBig ? "big" : ""}>
            <span className="fd">{f.date}</span>
            <span className="fk" style={{ color: f.isBig ? "var(--ink)" : "var(--gray)" }}>
              {f.baseName ?? "—"}
            </span>
            <span className="fb">
              {f.isBig ? <span className="mk">⚡ {f.title}</span> : f.title}
              {f.body && <small>{f.body}</small>}
            </span>
          </li>
        ))}
      </ul>
      {limit < activities.length && (
        <button className="loadmore" onClick={() => setLimit((l) => l + PAGE)}>
          もっと見る（残り {activities.length - limit} 件）
        </button>
      )}
      <div className="footnote">
        イベント成立・ステータス前進を時系列で記録。is_big（トリガー成立）は黒塗りハイライト。n8n経由でSlack通知と連動する想定です。
      </div>
    </>
  );
}
