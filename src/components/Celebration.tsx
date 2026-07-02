"use client";

export interface CelebrationState {
  code: string; // 'T3'
  title: string; // 'T3 準備室発足 成立'
  subtitle: string;
}

export default function Celebration({
  state,
  onClose,
}: {
  state: CelebrationState | null;
  onClose: () => void;
}) {
  return (
    <div id="cele" className={state ? "on" : ""} aria-hidden={!state}>
      <div className="cbar b1" />
      <div className="cbar b2" />
      <div className="cbar b3" />
      <div className="cbar b4" />
      <div className="cbar b5" />
      <div className="cbar b6" />
      <div className="cmsg">
        <div className="ck">TRIGGER {state?.code ?? ""}</div>
        <div className="ct">{state?.title ?? ""}</div>
        <div className="cs">{state?.subtitle ?? ""}</div>
        <button className="cx" onClick={onClose}>
          ボードに戻る
        </button>
      </div>
    </div>
  );
}
