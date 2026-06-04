import { ReactNode } from "react";
import type { Status } from "@/lib/api";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 leading-tight">{title}</h1>
        {description && <p className="text-[13px] text-zinc-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export const STATUS_META: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  embedded: { label: "Embedded", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  implemented: { label: "Implemented", dot: "bg-teal-500", text: "text-teal-700", bg: "bg-teal-50" },
  in_progress: { label: "In progress", dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50" },
  not_started: { label: "Not started", dot: "bg-zinc-300", text: "text-zinc-500", bg: "bg-zinc-50" },
};

export function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status] ?? STATUS_META.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 60) return "#14b8a6";
  if (score >= 30) return "#f59e0b";
  if (score > 0) return "#f97316";
  return "#d4d4d8";
}

export function ScoreBar({ score, height = 6 }: { score: number; height?: number }) {
  return (
    <div className="w-full rounded-full bg-zinc-100 overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(score, 2)}%`, background: scoreColor(score) }}
      />
    </div>
  );
}

export function ReadinessRing({ score, size = 132, band }: { score: number; size?: number; band?: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f1f3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-semibold tabular-nums text-zinc-900 leading-none">{Math.round(score)}</span>
        <span className="text-[10px] text-zinc-400 mt-0.5">/ 100</span>
        {band && <span className="text-[10px] font-medium mt-1" style={{ color }}>{band}</span>}
      </div>
    </div>
  );
}

export const SEVERITY_META: Record<string, { text: string; bg: string; label: string }> = {
  high: { text: "text-red-700", bg: "bg-red-50", label: "High" },
  medium: { text: "text-amber-700", bg: "bg-amber-50", label: "Medium" },
  low: { text: "text-zinc-600", bg: "bg-zinc-100", label: "Low" },
};

export function SeverityPill({ severity }: { severity: string }) {
  const m = SEVERITY_META[severity] ?? SEVERITY_META.low;
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${m.bg} ${m.text}`}>{m.label}</span>;
}
