import React from 'react';
import { formatDZD } from '../../utils/helpers';
import { useI18n } from '../../i18n';

export const CircularGauge: React.FC<{
  percent: number;
  colorClass: string;
  trackClass?: string;
  size?: number;
}> = ({ percent, colorClass, trackClass = 'text-slate-200 dark:text-slate-800', size = 64 }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-700`}
        />
      </svg>
      <span className="absolute text-xs font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
        {clamped}%
      </span>
    </div>
  );
};

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const DONUT_PALETTE = ['#059669', '#0284c7', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#64748b'];

export const DonutChart: React.FC<{
  slices: Array<{ label: string; value: number }>;
  centerLabel?: string;
}> = ({ slices, centerLabel }) => {
  const { lang } = useI18n();
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const size = 148;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-100 dark:text-slate-800"
          />
          {total > 0 &&
            slices.map((s, idx) => {
              const fraction = Math.max(0, s.value) / total;
              const dash = fraction * circumference;
              const offset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={DONUT_PALETTE[idx % DONUT_PALETTE.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {centerLabel && <span className="text-[10px] text-slate-400 font-medium">{centerLabel}</span>}
          <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatDZD(total, lang)}
          </span>
        </div>
      </div>

      <div className="grow w-full space-y-2 text-xs">
        {slices.slice(0, 6).map((s, idx) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: DONUT_PALETTE[idx % DONUT_PALETTE.length] }}
                />
                <span className="text-slate-700 dark:text-slate-300 truncate">{s.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                <span className="font-bold text-slate-900 dark:text-white">{formatDZD(s.value, lang)}</span>
                <span className="text-slate-400 text-[11px] w-8 text-end">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface CashflowPoint {
  label: string;
  income: number;
  expense: number;
}

export const CashflowBarChart: React.FC<{ points: CashflowPoint[] }> = ({ points }) => {
  const { lang, t } = useI18n();
  const maxVal = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-4 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          {t('incomes')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          {t('expenses')}
        </span>
      </div>

      <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3 items-end h-40 pt-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        {points.map((pt) => {
          const incH = Math.max(pt.income > 0 ? 6 : 0, Math.round((pt.income / maxVal) * 100));
          const expH = Math.max(pt.expense > 0 ? 6 : 0, Math.round((pt.expense / maxVal) * 100));
          return (
            <div key={pt.label} className="flex flex-col items-center h-full justify-end gap-1.5 group">
              <div className="w-full flex items-end justify-center gap-1 h-full">
                <div
                  title={`${t('incomes')}: ${formatDZD(pt.income, lang)}`}
                  className="w-3 sm:w-4 rounded-t bg-emerald-500/90 group-hover:bg-emerald-500 transition-all"
                  style={{ height: `${incH}%` }}
                />
                <div
                  title={`${t('expenses')}: ${formatDZD(pt.expense, lang)}`}
                  className="w-3 sm:w-4 rounded-t bg-rose-500/85 group-hover:bg-rose-500 transition-all"
                  style={{ height: `${expH}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full">
                {pt.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FloorCollectionChart: React.FC<{
  floors: Array<{ label: string; paid: number; total: number }>;
}> = ({ floors }) => {
  return (
    <div className="space-y-2.5">
      {floors.map((f) => {
        const pct = f.total > 0 ? Math.round((f.paid / f.total) * 100) : 0;
        return (
          <div key={f.label} className="flex items-center gap-3 text-xs">
            <span className="w-16 font-mono font-semibold text-slate-600 dark:text-slate-300 shrink-0">
              {f.label}
            </span>
            <div className="grow bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 text-end font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
              {f.paid}/{f.total} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};
