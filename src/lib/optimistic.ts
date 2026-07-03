// クライアント側の楽観的更新（demo モード＝Supabase未設定でも成立演出後に反映）。
// Supabase モードでは router.refresh() が本データで上書きするため一時的な見た目。

import type { DashboardData, ActivityItem } from "./types";
import { computeClock, mmdd } from "./domain";

export interface AppliedTrigger {
  baseCode: string;
  triggerCode: string;
  achievedOn: string;
  participants: string;
  evidence: string;
  recordedBy: string;
}

// 成立の取り消し（削除）を即時反映
export function removeTriggerEvent(
  data: DashboardData,
  p: { baseCode: string; triggerCode: string; actorName: string },
): DashboardData {
  const trg = data.triggers.find((t) => t.code === p.triggerCode);
  const bases = data.bases.map((b) => {
    if (b.code !== p.baseCode) return b;
    if (!b.achievedCodes.includes(p.triggerCode)) return b;
    const achievedCodes = b.achievedCodes.filter((c) => c !== p.triggerCode);
    const done = achievedCodes.length;
    const clockStartIso = trg?.isClockStart ? null : b.clockStartIso;
    const clock = computeClock(clockStartIso, b.deadlineDays, data.today);
    const nextT =
      data.triggers.find((t) => !achievedCodes.includes(t.code)) ??
      data.triggers[data.triggers.length - 1];
    return {
      ...b,
      achievedCodes,
      done,
      clockStartIso,
      daysLeft: clock.daysLeft,
      deadlineLabel: clock.deadlineLabel,
      clockPct: clock.clockPct,
      next: { code: nextT.code, name: nextT.name, note: b.next.note, ready: b.next.ready },
      history: b.history.filter((h) => !h.title.startsWith(`${p.triggerCode} `)),
    };
  });

  const base = data.bases.find((b) => b.code === p.baseCode);
  const activity: ActivityItem = {
    id: `local-undo-${p.baseCode}-${p.triggerCode}`,
    date: mmdd(data.today),
    isoDate: data.today,
    baseName: base?.name ?? null,
    kind: "system",
    title: `${p.triggerCode} ${trg?.name ?? ""} の成立を取り消し`,
    body: null,
    isBig: false,
    actorName: p.actorName,
  };

  return {
    ...data,
    bases,
    activities: [activity, ...data.activities.filter((a) => a.id !== activity.id)],
    company: { ...data.company, eventsDone: bases.reduce((s, b) => s + b.done, 0) },
  };
}

export function applyTriggerEvent(data: DashboardData, p: AppliedTrigger): DashboardData {
  const trg = data.triggers.find((t) => t.code === p.triggerCode);
  const bases = data.bases.map((b) => {
    if (b.code !== p.baseCode) return b;
    if (b.achievedCodes.includes(p.triggerCode)) return b;
    const achievedCodes = [...b.achievedCodes, p.triggerCode];
    const done = achievedCodes.length;
    const clockStartIso = trg?.isClockStart ? p.achievedOn : b.clockStartIso;
    const clock = computeClock(clockStartIso, b.deadlineDays, data.today);
    const nextT = data.triggers[Math.min(done, data.triggers.length - 1)];
    return {
      ...b,
      achievedCodes,
      done,
      clockStartIso,
      daysLeft: clock.daysLeft,
      deadlineLabel: clock.deadlineLabel,
      clockPct: clock.clockPct,
      next: { code: nextT.code, name: nextT.name, note: b.next.note, ready: b.next.ready },
      history: [
        {
          date: mmdd(p.achievedOn),
          isoDate: p.achievedOn,
          title: `${p.triggerCode} ${trg?.name ?? ""} 成立`,
          evidence: p.evidence,
          isTrigger: true,
        },
        ...b.history,
      ],
      proposeT3: p.triggerCode === "T3" ? false : b.proposeT3,
      proposeT7: p.triggerCode === "T7" ? false : b.proposeT7,
    };
  });

  const base = data.bases.find((b) => b.code === p.baseCode);
  const activity: ActivityItem = {
    id: `local-${p.baseCode}-${p.triggerCode}-${p.achievedOn}`,
    date: mmdd(p.achievedOn),
    isoDate: p.achievedOn,
    baseName: base?.name ?? null,
    kind: "trigger",
    title: `${p.triggerCode} ${trg?.name ?? ""} 成立`,
    body: p.evidence,
    isBig: true,
    actorName: p.recordedBy,
  };

  return {
    ...data,
    bases,
    activities: [activity, ...data.activities.filter((a) => a.id !== activity.id)],
    company: { ...data.company, eventsDone: bases.reduce((s, b) => s + b.done, 0) },
  };
}
