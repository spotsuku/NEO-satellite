// =============================================================================
// 県シルエット SVG パス生成（サーバー専用ロジック / scripts からも利用）
// dataofjapan/land の japan.geojson から都道府県ポリゴンを取り出し、
// Douglas-Peucker で簡略化 → 100x100 に正規化して SVG パス文字列にする。
// モック制作時の Python ロジックの TS 移植。
// =============================================================================

export const JAPAN_GEOJSON_URL =
  "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson";

type Ring = [number, number][];

interface GeoFeature {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

// Douglas-Peucker 簡略化
function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 3) return ring;
  const sqTol = tolerance * tolerance;

  function sqSegDist(p: [number, number], a: [number, number], b: [number, number]): number {
    let [x, y] = a;
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  }

  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(ring[i], ring[first], ring[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > sqTol && index !== -1) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
}

/** GeoJSON Feature 群から都道府県名（例: '大分' / '大分県' / 'Oita'）で検索 */
export function findPrefecture(features: GeoFeature[], query: string): GeoFeature | null {
  const q = query.replace(/県|府|都|道$/g, "").toLowerCase();
  for (const f of features) {
    const names = Object.values(f.properties).map((v) => String(v ?? "").toLowerCase());
    if (names.some((n) => n.replace(/県|府|都|道$/g, "").includes(q))) return f;
  }
  return null;
}

/**
 * 都道府県 Feature → 100x100 正規化 SVG パス。
 * - 経度縮尺は中心緯度の cos で補正（見た目の歪み防止）
 * - 面積が最大リングの 0.8% 未満の小島は除外
 * - 許容誤差は bbox の 0.6% （モックの密度感に合わせる）
 */
export function featureToPath(feature: GeoFeature): string {
  const geom = feature.geometry;
  const polys: Ring[] =
    geom.type === "Polygon"
      ? [(geom.coordinates as number[][][])[0] as Ring]
      : (geom.coordinates as number[][][][]).map((p) => p[0] as Ring);

  // bbox（緯度補正前）
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const ring of polys)
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  const latScale = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);

  // 補正座標系に変換（x*latScale, y は反転してSVG座標へ）
  const proj = (p: [number, number]): [number, number] => [p[0] * latScale, -p[1]];
  const projected = polys.map((r) => r.map(proj) as Ring);

  // 投影後 bbox
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  for (const ring of projected)
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = 100 / Math.max(w, h);
  const ox = (100 - w * scale) / 2;
  const oy = (100 - h * scale) / 2;

  const tolerance = Math.max(w, h) * 0.006;
  const simplified = projected
    .map((r) => simplify(r, tolerance))
    .filter((r) => r.length >= 4);

  const maxArea = Math.max(...simplified.map(ringArea));
  const kept = simplified.filter((r) => ringArea(r) >= maxArea * 0.008);

  const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
  return kept
    .map((ring) => {
      const pts = ring.map(
        ([x, y]) => `${fmt((x - minX) * scale + ox)} ${fmt((y - minY) * scale + oy)}`,
      );
      return `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ") + "Z";
    })
    .join(" ");
}

/** GeoJSON を取得して県名からパスを生成（サーバー / スクリプト用） */
export async function generateSilhouette(prefName: string): Promise<string> {
  const res = await fetch(JAPAN_GEOJSON_URL);
  if (!res.ok) throw new Error(`GeoJSON の取得に失敗: HTTP ${res.status}`);
  const geo = (await res.json()) as { features: GeoFeature[] };
  const feature = findPrefecture(geo.features, prefName);
  if (!feature) throw new Error(`都道府県が見つかりません: ${prefName}`);
  return featureToPath(feature);
}
