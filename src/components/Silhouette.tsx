"use client";

// 県シルエット: 進捗で下から黒塗り + ピンク水位線（design モック移植）
export default function Silhouette({
  id,
  path,
  progress,
}: {
  id: string;
  path: string | null;
  progress: number; // 0..1
}) {
  if (!path) {
    return <div className="sil" aria-hidden style={{ background: "#F4F4F1" }} />;
  }
  const y = 100 - progress * 100;
  const clipId = `clip-${id}`;
  return (
    <svg className="sil" viewBox="-4 -4 108 108" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>
      <path d={path} fill="#F4F4F1" stroke="var(--ink)" strokeWidth={1.4} strokeLinejoin="round" />
      <g clipPath={`url(#${clipId})`}>
        <rect x={-4} y={y} width={108} height={progress * 100 + 4} fill="var(--ink)" />
        {progress > 0 && <rect x={-4} y={y - 1.5} width={108} height={1.5} fill="var(--pink)" />}
      </g>
    </svg>
  );
}
