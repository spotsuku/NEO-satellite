"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BaseView, Stakeholder } from "@/lib/types";

interface MNode {
  id: string;
  label: string;
  sub: string;
  status: string | null;
  hub: boolean;
  x: number;
  y: number;
}
interface MEdge {
  a: string;
  b: string;
  type: string;
}

const ZONES: Record<string, [number, number]> = {
  オーナー候補: [0.1, 0.1],
  教育機関: [0.68, 0.12],
  "自治体・メディア": [0.12, 0.72],
  事務局: [0.68, 0.7],
  学生事務局: [0.72, 0.4],
};

export default function MapView({
  bases,
  stakeholders,
  relTypes,
  statuses,
}: {
  bases: BaseView[];
  stakeholders: Stakeholder[];
  relTypes: { name: string; color: string }[];
  statuses: { name: string; color: string }[];
}) {
  const [activeBase, setActiveBase] = useState(bases[0]?.code ?? "");
  const [edgeType, setEdgeType] = useState(relTypes[0]?.name ?? "紹介");
  const [nodes, setNodes] = useState<MNode[]>([]);
  const [edges, setEdges] = useState<MEdge[]>([]);
  const [centers, setCenters] = useState<Record<string, { x: number; y: number }>>({});
  const [tmpLine, setTmpLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cache = useRef<Record<string, { nodes: MNode[]; edges: MEdge[] }>>({});
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const link = useRef<{ from: string } | null>(null);

  const relColor = useCallback(
    (t: string) => relTypes.find((r) => r.name === t)?.color ?? "#00C0F0",
    [relTypes],
  );
  const statusColor = useCallback(
    (s: string | null) => (s ? statuses.find((x) => x.name === s)?.color ?? null : null),
    [statuses],
  );

  const seed = useCallback(
    (baseCode: string): { nodes: MNode[]; edges: MEdge[] } => {
      const cv = canvasRef.current;
      const W = cv?.clientWidth ?? 1100;
      const H = 600;
      const base = bases.find((b) => b.code === baseCode);
      const nodes: MNode[] = [
        { id: "hub", label: `NEO ${base?.name ?? ""}`, sub: "サテライト拠点", status: null, hub: true, x: W * 0.42, y: H * 0.42 },
      ];
      const cnt: Record<string, number> = {};
      stakeholders
        .filter((s) => s.baseCode === baseCode)
        .forEach((s, i) => {
          const z = ZONES[s.category] ?? [0.45, 0.75];
          cnt[s.category] = cnt[s.category] ?? 0;
          nodes.push({
            id: `s${i}`,
            label: s.name.replace("（リスト作成中）", "リスト作成中"),
            sub: s.category + (s.isSample ? "（サンプル）" : ""),
            status: s.status,
            hub: false,
            x: W * z[0] + (cnt[s.category] % 2) * 195,
            y: H * z[1] + Math.floor(cnt[s.category] / 2) * 74,
          });
          cnt[s.category]++;
        });
      return { nodes, edges: [] };
    },
    [bases, stakeholders],
  );

  // 拠点切替時にノード/エッジをロード（セッション内キャッシュ）
  useEffect(() => {
    if (!activeBase) return;
    if (!cache.current[activeBase]) cache.current[activeBase] = seed(activeBase);
    setNodes(cache.current[activeBase].nodes.map((n) => ({ ...n })));
    setEdges(cache.current[activeBase].edges.map((e) => ({ ...e })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBase]);

  // 中心座標を測定（ノード位置・数が変わるたび）
  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cr = cv.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      const el = nodeRefs.current[n.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[n.id] = { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    }
    setCenters(next);
  }, [nodes]);

  function persist(nextNodes: MNode[], nextEdges: MEdge[]) {
    cache.current[activeBase] = { nodes: nextNodes, edges: nextEdges };
  }

  const onPointerDown = (e: React.PointerEvent, nodeId: string, isPort: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPort) {
      link.current = { from: nodeId };
      return;
    }
    const cv = canvasRef.current!;
    const cr = cv.getBoundingClientRect();
    const n = nodes.find((x) => x.id === nodeId)!;
    drag.current = { id: nodeId, dx: e.clientX - cr.left - n.x, dy: e.clientY - cr.top - n.y };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const cr = cv.getBoundingClientRect();
      if (drag.current) {
        const d = drag.current;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === d.id
              ? {
                  ...n,
                  x: Math.max(0, Math.min(cr.width - 140, e.clientX - cr.left - d.dx)),
                  y: Math.max(0, Math.min(cr.height - 54, e.clientY - cr.top - d.dy)),
                }
              : n,
          ),
        );
      }
      if (link.current) {
        const c = centers[link.current.from];
        if (c) setTmpLine({ x1: c.x, y1: c.y, x2: e.clientX - cr.left, y2: e.clientY - cr.top });
      }
    };
    const up = (e: PointerEvent) => {
      if (link.current) {
        const tgt = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(
          ".mnode",
        ) as HTMLElement | null;
        const toId = tgt?.dataset.id;
        if (toId && toId !== link.current.from) {
          setEdges((prev) => {
            const exists = prev.some(
              (x) =>
                (x.a === link.current!.from && x.b === toId) ||
                (x.b === link.current!.from && x.a === toId),
            );
            const next = exists ? prev : [...prev, { a: link.current!.from, b: toId, type: edgeType }];
            persist(nodes, next);
            return next;
          });
        }
        link.current = null;
        setTmpLine(null);
      }
      if (drag.current) {
        drag.current = null;
        persist(nodes, edges);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [centers, nodes, edges, edgeType, activeBase]);

  function delEdge(i: number) {
    setEdges((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      persist(nodes, next);
      return next;
    });
  }
  function resetMap() {
    delete cache.current[activeBase];
    cache.current[activeBase] = seed(activeBase);
    setNodes(cache.current[activeBase].nodes.map((n) => ({ ...n })));
    setEdges([]);
  }

  return (
    <>
      <div className="maptools">
        <div className="filters" style={{ marginBottom: 0 }}>
          {bases.map((b) => (
            <button key={b.code} className={b.code === activeBase ? "on" : ""} onClick={() => setActiveBase(b.code)}>
              {b.name}
            </button>
          ))}
        </div>
        <div className="mtype">
          つなぐ線：
          <span>
            {relTypes.map((t) => (
              <button key={t.name} className={t.name === edgeType ? "on" : ""} onClick={() => setEdgeType(t.name)}>
                <i style={{ background: t.color, display: "inline-block", width: 12, height: 3, marginRight: 5, verticalAlign: 3 }} />
                {t.name}
              </button>
            ))}
          </span>
        </div>
        <button className="mreset" onClick={resetMap}>
          配置リセット
        </button>
      </div>
      <div className="maphint">
        カードをドラッグ＝移動 ／ カード右端の端子を別のカードへドラッグ＝線でつなぐ ／ 線をクリック＝削除（配置はこのセッション中のみ保持・Supabase永続化はPhase 2）
      </div>
      <div className="canvas" ref={canvasRef} style={{ touchAction: "none" }}>
        <svg id="edges">
          {edges.map((e, i) => {
            const a = centers[e.a];
            const b = centers[e.b];
            if (!a || !b) return null;
            const col = relColor(e.type);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={2.5} onClick={() => delEdge(i)}>
                  <title>{e.type}（クリックで削除）</title>
                </line>
                <text x={mx + 6} y={my - 6} onClick={() => delEdge(i)}>
                  {e.type}
                </text>
              </g>
            );
          })}
          {tmpLine && (
            <line
              x1={tmpLine.x1}
              y1={tmpLine.y1}
              x2={tmpLine.x2}
              y2={tmpLine.y2}
              stroke="#F03090"
              strokeWidth={2}
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
        </svg>

        {nodes.map((n) => {
          const sc = statusColor(n.status);
          return (
            <div
              key={n.id}
              data-id={n.id}
              ref={(el) => {
                nodeRefs.current[n.id] = el;
              }}
              className={`mnode${n.hub ? " mhub" : ""}`}
              style={{ left: n.x, top: n.y }}
              onPointerDown={(e) => onPointerDown(e, n.id, false)}
            >
              <b>{n.label}</b>
              <small>
                {n.sub}
                {n.status ? ` ｜ ${n.status}` : ""}
              </small>
              {sc && <span className="msd" style={{ background: sc }} />}
              <span
                className="mport"
                title="ドラッグして別のカードへ"
                onPointerDown={(e) => onPointerDown(e, n.id, true)}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
