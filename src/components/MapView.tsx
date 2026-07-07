"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BaseView, Stakeholder, MapNodeView, MapEdgeView } from "@/lib/types";
import {
  addFreeMapNode,
  addMapEdge,
  deleteMapEdge,
  deleteMapNode,
  ensureMapHub,
  moveMapNode,
  placeMapNode,
  resetMapForBase,
  updateMapNodeMeta,
} from "@/app/actions";

// 内部表現。座標は 0-1 比率（解像度非依存・DB保存形式と同一）
interface MNode {
  key: string; // Supabase: map_nodes.id / モック: 合成キー
  dbId: string | null;
  stakeholderId: string | null;
  label: string;
  sub: string;
  status: string | null;
  hub: boolean;
  free: boolean; // 写真・付箋ノード
  imageUrl: string | null;
  url: string | null;
  memo: string | null;
  x: number;
  y: number;
}
interface MEdge {
  key: string;
  dbId: string | null;
  a: string; // MNode.key
  b: string;
  type: string;
}

const H = 600;
const ZONES: Record<string, [number, number]> = {
  オーナー候補: [0.1, 0.1],
  企業会員候補: [0.4, 0.1],
  教育機関: [0.68, 0.12],
  "自治体・メディア": [0.12, 0.72],
  事務局: [0.68, 0.7],
  学生事務局: [0.72, 0.4],
  紹介役: [0.12, 0.4],
};

export default function MapView({
  bases,
  stakeholders,
  relTypes,
  statuses,
  usingSupabase,
  mapNodes,
  mapEdges,
  recorderName,
}: {
  bases: BaseView[];
  stakeholders: Stakeholder[];
  relTypes: { name: string; color: string }[];
  statuses: { name: string; color: string }[];
  usingSupabase: boolean;
  mapNodes: MapNodeView[];
  mapEdges: MapEdgeView[];
  recorderName: string;
}) {
  const [activeBase, setActiveBase] = useState(bases[0]?.code ?? "");
  const [edgeType, setEdgeType] = useState(relTypes[0]?.name ?? "紹介");
  const [nodes, setNodes] = useState<MNode[]>([]);
  const [edges, setEdges] = useState<MEdge[]>([]);
  const [canvasW, setCanvasW] = useState(1100);
  const [centers, setCenters] = useState<Record<string, { x: number; y: number }>>({});
  const [tmpLine, setTmpLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [editNode, setEditNode] = useState<MNode | null>(null);
  const [dropHint, setDropHint] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mockCache = useRef<Record<string, { nodes: MNode[]; edges: MEdge[] }>>({});
  const hubEnsured = useRef<Set<string>>(new Set());
  const drag = useRef<{ key: string; dx: number; dy: number } | null>(null);
  const link = useRef<{ from: string } | null>(null);

  const relColor = useCallback(
    (t: string) => relTypes.find((r) => r.name === t)?.color ?? "#00C0F0",
    [relTypes],
  );
  const statusColor = useCallback(
    (s: string | null) => (s ? statuses.find((x) => x.name === s)?.color ?? null : null),
    [statuses],
  );
  const baseName = bases.find((b) => b.code === activeBase)?.name ?? "";

  // キャンバス幅を測定
  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const update = () => setCanvasW(cv.clientWidth || 1100);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  // モック用シード: 拠点の全ステークホルダーをゾーン配置
  const seedMock = useCallback(
    (baseCode: string): { nodes: MNode[]; edges: MEdge[] } => {
      const b = bases.find((x) => x.code === baseCode);
      const nodes: MNode[] = [
        {
          key: "hub",
          dbId: null,
          stakeholderId: null,
          label: `NEO ${b?.name ?? ""}`,
          sub: "サテライト拠点",
          status: null,
          hub: true,
          free: false,
          imageUrl: null,
          url: null,
          memo: null,
          x: 0.42,
          y: 0.42,
        },
      ];
      const cnt: Record<string, number> = {};
      stakeholders
        .filter((s) => s.baseCode === baseCode)
        .forEach((s, i) => {
          const z = ZONES[s.category] ?? [0.45, 0.75];
          cnt[s.category] = cnt[s.category] ?? 0;
          nodes.push({
            key: `s${i}`,
            dbId: null,
            stakeholderId: s.id,
            label: s.name.replace("（リスト作成中）", "リスト作成中"),
            sub: s.category + (s.isSample ? "（サンプル）" : ""),
            status: s.status,
            hub: false,
            free: false,
            imageUrl: null,
            url: null,
            memo: null,
            x: z[0] + ((cnt[s.category] % 2) * 195) / 1100,
            y: z[1] + (Math.floor(cnt[s.category] / 2) * 74) / H,
          });
          cnt[s.category]++;
        });
      return { nodes, edges: [] };
    },
    [bases, stakeholders],
  );

  // Supabase: props → ローカル state 同期（ドラッグ中はスキップ）
  useEffect(() => {
    if (!activeBase) return;
    if (drag.current) return;
    if (usingSupabase) {
      const shById = new Map(stakeholders.map((s) => [s.id, s]));
      const ns: MNode[] = mapNodes
        .filter((n) => n.baseCode === activeBase)
        .map((n) => {
          const sh = n.stakeholderId ? shById.get(n.stakeholderId) : null;
          return {
            key: n.id,
            dbId: n.id,
            stakeholderId: n.stakeholderId,
            label: n.kind === "hub" ? `NEO ${baseName}` : (sh?.name ?? n.label ?? (n.imageUrl ? "" : "メモ")),
            sub: n.kind === "hub" ? "サテライト拠点" : (sh ? sh.category + (sh.isSample ? "（サンプル）" : "") : ""),
            status: sh?.status ?? null,
            hub: n.kind === "hub",
            free: n.kind === "free",
            imageUrl: n.imageUrl,
            url: n.url ?? (sh?.url || null),
            memo: n.memo,
            x: n.x,
            y: n.y,
          };
        });
      setNodes(ns);
      setEdges(
        mapEdges
          .filter((e) => e.baseCode === activeBase)
          .map((e) => ({ key: e.id, dbId: e.id, a: e.fromNodeId, b: e.toNodeId, type: e.relType })),
      );
      // ハブが無ければ作成（拠点ごとに一度だけ）
      if (!ns.some((n) => n.hub) && !hubEnsured.current.has(activeBase)) {
        hubEnsured.current.add(activeBase);
        void ensureMapHub(activeBase);
      }
    } else {
      if (!mockCache.current[activeBase]) mockCache.current[activeBase] = seedMock(activeBase);
      setNodes(mockCache.current[activeBase].nodes.map((n) => ({ ...n })));
      setEdges(mockCache.current[activeBase].edges.map((e) => ({ ...e })));
    }
  }, [activeBase, usingSupabase, mapNodes, mapEdges, stakeholders, baseName, seedMock]);

  // ノード中心（px）を測定 → エッジ描画
  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cr = cv.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      const el = nodeRefs.current[n.key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[n.key] = { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    }
    setCenters(next);
  }, [nodes, canvasW]);

  function persistMock(nextNodes: MNode[], nextEdges: MEdge[]) {
    if (!usingSupabase) mockCache.current[activeBase] = { nodes: nextNodes, edges: nextEdges };
  }

  // 未配置プール（Supabase モードのみ意味を持つ）
  const placedIds = new Set(nodes.map((n) => n.stakeholderId).filter(Boolean));
  const pool = usingSupabase
    ? stakeholders.filter((s) => s.baseCode === activeBase && !placedIds.has(s.id))
    : [];

  async function placeFromPool(s: Stakeholder) {
    const z = ZONES[s.category] ?? [0.45, 0.75];
    const jitter = (placedIds.size % 3) * 0.04;
    await placeMapNode({
      baseCode: activeBase,
      stakeholderId: s.id,
      x: Math.min(0.85, z[0] + jitter),
      y: Math.min(0.85, z[1] + jitter),
      actorName: recorderName,
    });
  }

  // 画像を最大320pxのJPEG data URLに縮小（DB保存・Realtime配信可能なサイズに）
  async function fileToThumb(file: File): Promise<string> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return cv.toDataURL("image/jpeg", 0.8);
  }

  // キャンバスへの写真ドラッグ&ドロップ → フリーノード作成
  async function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropHint(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const cr = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(0.85, (e.clientX - cr.left) / cr.width));
    const y = Math.max(0, Math.min(0.85, (e.clientY - cr.top) / cr.height));
    let thumb: string;
    try {
      thumb = await fileToThumb(file);
    } catch {
      window.alert("画像の読み込みに失敗しました");
      return;
    }
    const label = file.name.replace(/\.[^.]+$/, "");
    if (usingSupabase) {
      const res = await addFreeMapNode({
        baseCode: activeBase,
        x,
        y,
        label,
        imageDataUrl: thumb,
        actorName: recorderName,
      });
      if (!res.ok) window.alert(res.error ?? "追加に失敗しました");
    } else {
      setNodes((prev) => {
        const next = [
          ...prev,
          {
            key: `f${Date.now()}`,
            dbId: null,
            stakeholderId: null,
            label,
            sub: "",
            status: null,
            hub: false,
            free: true,
            imageUrl: thumb,
            url: null,
            memo: null,
            x,
            y,
          },
        ];
        persistMock(next, edges);
        return next;
      });
    }
  }

  // ノードのメタ（ラベル・URL・メモ）保存
  async function saveNodeMeta(n: MNode, f: { label: string; url: string; memo: string }) {
    setNodes((prev) => {
      const next = prev.map((x) =>
        x.key === n.key ? { ...x, label: f.label || x.label, url: f.url || null, memo: f.memo || null } : x,
      );
      persistMock(next, edges);
      return next;
    });
    setEditNode(null);
    if (usingSupabase && n.dbId) {
      await updateMapNodeMeta({
        nodeId: n.dbId,
        label: n.free ? f.label : undefined,
        url: f.url,
        memo: f.memo,
        actorName: recorderName,
      });
    }
  }

  async function removeNode(n: MNode) {
    setNodes((prev) => {
      const next = prev.filter((x) => x.key !== n.key);
      persistMock(next, edges.filter((e) => e.a !== n.key && e.b !== n.key));
      return next;
    });
    setEdges((prev) => prev.filter((e) => e.a !== n.key && e.b !== n.key));
    setEditNode(null);
    if (usingSupabase && n.dbId) await deleteMapNode(n.dbId);
  }

  const onPointerDown = (e: React.PointerEvent, nodeKey: string, isPort: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPort) {
      link.current = { from: nodeKey };
      return;
    }
    const cv = canvasRef.current!;
    const cr = cv.getBoundingClientRect();
    const n = nodes.find((x) => x.key === nodeKey)!;
    drag.current = { key: nodeKey, dx: e.clientX - cr.left - n.x * cr.width, dy: e.clientY - cr.top - n.y * cr.height };
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
            n.key === d.key
              ? {
                  ...n,
                  x: Math.max(0, Math.min((cr.width - 140) / cr.width, (e.clientX - cr.left - d.dx) / cr.width)),
                  y: Math.max(0, Math.min((cr.height - 54) / cr.height, (e.clientY - cr.top - d.dy) / cr.height)),
                }
              : n,
          ),
        );
      }
      if (link.current) {
        const c = centers[link.current.from];
        if (c) setTmpLine({ x1: c.x, y1: c.y, x2: e.clientX - cr.left, y2: e.clientY - cr.top });
        cv.querySelectorAll(".mnode").forEach((n) => n.classList.remove("linktarget"));
        const tgt = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(".mnode");
        if (tgt && (tgt as HTMLElement).dataset.id !== link.current.from) tgt.classList.add("linktarget");
      }
    };
    const up = (e: PointerEvent) => {
      if (link.current) {
        const from = link.current.from;
        const tgt = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(
          ".mnode",
        ) as HTMLElement | null;
        const toKey = tgt?.dataset.id;
        if (toKey && toKey !== from) {
          const exists = edges.some((x) => (x.a === from && x.b === toKey) || (x.b === from && x.a === toKey));
          if (!exists) {
            if (usingSupabase) {
              void addMapEdge({
                baseCode: activeBase,
                fromNodeId: from,
                toNodeId: toKey,
                relType: edgeType,
                actorName: recorderName,
              });
              // 楽観反映（refresh 後に本物の id へ置き換わる）
              setEdges((prev) => [...prev, { key: `tmp-${from}-${toKey}`, dbId: null, a: from, b: toKey, type: edgeType }]);
            } else {
              setEdges((prev) => {
                const next = [...prev, { key: `e${prev.length}-${from}-${toKey}`, dbId: null, a: from, b: toKey, type: edgeType }];
                persistMock(nodes, next);
                return next;
              });
            }
          }
        }
        canvasRef.current?.querySelectorAll(".mnode").forEach((n) => n.classList.remove("linktarget"));
        link.current = null;
        setTmpLine(null);
      }
      if (drag.current) {
        const key = drag.current.key;
        drag.current = null;
        const n = nodes.find((x) => x.key === key);
        if (n) {
          if (usingSupabase && n.dbId) void moveMapNode({ nodeId: n.dbId, x: n.x, y: n.y, actorName: recorderName });
          else persistMock(nodes, edges);
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers, nodes, edges, edgeType, activeBase, usingSupabase, recorderName]);

  function delEdge(edge: MEdge) {
    if (usingSupabase && edge.dbId) {
      void deleteMapEdge(edge.dbId);
      setEdges((prev) => prev.filter((x) => x.key !== edge.key));
    } else {
      setEdges((prev) => {
        const next = prev.filter((x) => x.key !== edge.key);
        persistMock(nodes, next);
        return next;
      });
    }
  }

  async function resetMap() {
    if (usingSupabase) {
      hubEnsured.current.delete(activeBase);
      await resetMapForBase(activeBase);
    } else {
      delete mockCache.current[activeBase];
      mockCache.current[activeBase] = seedMock(activeBase);
      setNodes(mockCache.current[activeBase].nodes.map((n) => ({ ...n })));
      setEdges([]);
    }
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
        カードをドラッグ＝移動 ／ 端子ドラッグ＝線でつなぐ ／ 線クリック＝削除 ／ <b>写真をドロップ＝画像ノード追加</b> ／ <b>ダブルクリック＝URL・メモ編集</b>
        {usingSupabase
          ? " ／ 配置・接続は全員に共有されます（last-write-wins）"
          : " ／ モックモード：配置はこのセッション中のみ保持"}
      </div>

      {usingSupabase && pool.length > 0 && (
        <div className="filters" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--gray)" }}>未配置：</span>
          {pool.map((s) => (
            <button key={s.id} onClick={() => placeFromPool(s)} title="クリックでキャンバスに配置">
              ＋ {s.name}
            </button>
          ))}
        </div>
      )}

      <div
        className="canvas"
        ref={canvasRef}
        style={{ touchAction: "none", outline: dropHint ? "3px dashed var(--pink)" : "none", outlineOffset: -3 }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropHint(true);
        }}
        onDragLeave={() => setDropHint(false)}
        onDrop={onCanvasDrop}
      >
        <svg id="edges">
          {edges.map((e) => {
            const a = centers[e.a];
            const b = centers[e.b];
            if (!a || !b) return null;
            const col = relColor(e.type);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={e.key}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={2.5} onClick={() => delEdge(e)}>
                  <title>{e.type}（クリックで削除）</title>
                </line>
                <text x={mx + 6} y={my - 6} onClick={() => delEdge(e)}>
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
              key={n.key}
              data-id={n.key}
              ref={(el) => {
                nodeRefs.current[n.key] = el;
              }}
              className={`mnode${n.hub ? " mhub" : ""}${n.imageUrl ? " mimg" : ""}`}
              style={{ left: n.x * canvasW, top: n.y * H }}
              onPointerDown={(e) => onPointerDown(e, n.key, false)}
              onDoubleClick={() => !n.hub && setEditNode(n)}
              title={n.hub ? undefined : "ダブルクリックで URL・メモを編集"}
            >
              {n.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.imageUrl} alt={n.label} draggable={false} />
              )}
              {n.label && <b>{n.label}</b>}
              {(n.sub || n.status) && (
                <small>
                  {n.sub}
                  {n.status ? ` ｜ ${n.status}` : ""}
                </small>
              )}
              {n.memo && <small className="mmemo">📝 {n.memo}</small>}
              {n.url && /^https?:\/\//.test(n.url) && (
                <a
                  className="mlink"
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  title={n.url}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  ↗ リンク
                </a>
              )}
              {sc && <span className="msd" style={{ background: sc }} />}
              <span
                className="mport"
                title="ドラッグして別のカードへ"
                onPointerDown={(e) => onPointerDown(e, n.key, true)}
              />
            </div>
          );
        })}
      </div>

      {editNode && (
        <NodeEditModal
          node={editNode}
          onSave={(f) => saveNodeMeta(editNode, f)}
          onDelete={() => {
            if (window.confirm(editNode.stakeholderId ? "マップから外しますか？（ステークホルダー自体は残り、未配置に戻ります）" : "このノードを削除しますか？")) {
              void removeNode(editNode);
            }
          }}
          onClose={() => setEditNode(null)}
        />
      )}
    </>
  );
}

// ノードの URL・メモ・ラベル編集モーダル
function NodeEditModal({
  node,
  onSave,
  onDelete,
  onClose,
}: {
  node: MNode;
  onSave: (f: { label: string; url: string; memo: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [url, setUrl] = useState(node.url ?? "");
  const [memo, setMemo] = useState(node.memo ?? "");
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhd">
          <div>
            <div className="mk">MAP NODE</div>
            <h3>{node.stakeholderId ? node.label : "ノードを編集"}</h3>
          </div>
          <button className="x" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="mbd">
          {node.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 160, display: "block", margin: "0 auto 10px", border: "1px solid var(--line)" }} />
          )}
          {node.free && (
            <>
              <label>ラベル</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
            </>
          )}
          <label>URL</label>
          <input type="text" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
          <label>メモ</label>
          <textarea value={memo} style={{ minHeight: 56 }} placeholder="例: 会食で名刺交換。次回は工場見学" onChange={(e) => setMemo(e.target.value)} />
          <div className="mfoot">
            <button className="save" onClick={() => onSave({ label, url, memo })}>保存</button>
            <button className="cancel" style={{ borderColor: "var(--red)", color: "var(--red)" }} onClick={onDelete}>
              {node.stakeholderId ? "マップから外す" : "削除"}
            </button>
            <button className="cancel" onClick={onClose}>キャンセル</button>
          </div>
        </div>
      </div>
    </div>
  );
}
