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
  emptyNote?: string;
}> = ({ slices, centerLabel, emptyNote }) => {
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
          <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
            {formatDZD(total, lang)}
          </span>
        </div>
      </div>

      <div className="grow w-full space-y-2 text-xs">
        {total === 0 ? (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 leading-relaxed">
            {emptyNote ||
              (lang === 'ar'
                ? 'لا توجد مصاريف تشغيلية مسجلة في هذه الفترة.'
                : "Aucune dépense d'exploitation enregistrée sur cette période.")}
          </div>
        ) : (
          slices.slice(0, 6).map((s, idx) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <div key={s.label} className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: DONUT_PALETTE[idx % DONUT_PALETTE.length] }}
                  />
                  <span title={s.label} className="text-slate-700 dark:text-slate-300 leading-tight break-words">
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono tabular-nums shrink-0 whitespace-nowrap">
                  <span className="font-bold text-slate-900 dark:text-white">{formatDZD(s.value, lang)}</span>
                  <span className="text-slate-400 text-[11px] w-8 text-end">{pct}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export interface CashflowPoint {
  label: string;
  income: number;
  expense: number;
  cumulative?: number;
}

export const CashflowBarChart: React.FC<{ points: CashflowPoint[] }> = ({ points }) => {
  const { lang, t } = useI18n();
  const maxVal = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const hasCumulative = points.length > 0 && points.some((p) => typeof p.cumulative === 'number');
  const cumVals = points.map((p) => p.cumulative ?? 0);
  const minCum = Math.min(0, ...cumVals);
  const maxCum = Math.max(1, maxVal, ...cumVals);
  const cumSpan = Math.max(1, maxCum - minCum);
  const toY = (val: number) => 88 - ((val - minCum) / cumSpan) * 74;

  const polylinePoints = hasCumulative
    ? points
        .map((pt, idx) => {
          const x = ((idx + 0.5) / points.length) * 100;
          const y = toY(pt.cumulative ?? 0);
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ')
    : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-4 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          {t('incomes')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          {t('expenses')}
        </span>
        {hasCumulative && (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center">
              <span className="w-3 h-0.5 bg-amber-500" />
              <span className="w-2 h-2 rounded-full bg-amber-500 -ms-1.5" />
            </span>
            {lang === 'ar' ? 'الرصيد التراكمي' : 'Trésorerie cumulée'}
          </span>
        )}
      </div>

      <div className="relative">
        <div className="relative h-40 pt-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          {hasCumulative && (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 top-4 bottom-6 w-full h-[calc(100%-2.5rem)] overflow-visible z-10"
              >
                {minCum < 0 && (
                  <line
                    x1="0"
                    x2="100"
                    y1={toY(0)}
                    y2={toY(0)}
                    stroke="currentColor"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    className="text-slate-300 dark:text-slate-700"
                  />
                )}
                {points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={polylinePoints}
                  />
                )}
              </svg>
              {points.map((pt, idx) => {
                const leftPct = ((idx + 0.5) / points.length) * 100;
                const topPct = toY(pt.cumulative ?? 0);
                return (
                  <div
                    key={`dot-${pt.label}`}
                    title={`${pt.label} · ${lang === 'ar' ? 'الرصيد التراكمي' : 'Trésorerie cumulée'}: ${formatDZD(pt.cumulative ?? 0, lang)}`}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 shadow-xs"
                    style={{
                      left: `${leftPct}%`,
                      top: `calc(1rem + ${(topPct / 100) * 100}% * 0.72)`,
                    }}
                  />
                );
              })}
            </>
          )}

          <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3 items-end h-full">
            {points.map((pt) => {
              const incH = Math.max(pt.income > 0 ? 6 : 0, Math.round((pt.income / maxVal) * 100));
              const expH = Math.max(pt.expense > 0 ? 6 : 0, Math.round((pt.expense / maxVal) * 100));
              return (
                <div key={pt.label} className="flex flex-col items-center h-full justify-end gap-1.5 group relative">
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
                  <span className="absolute -bottom-5 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full">
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FloorCollectionChart: React.FC<{
  floors: Array<{ label: string; floorNumber?: number; paid: number; total: number }>;
  onSelectFloor?: (floorNumber: number, paid: number, total: number) => void;
}> = ({ floors, onSelectFloor }) => {
  return (
    <div className="space-y-1.5">
      {floors.map((f) => {
        const pct = f.total > 0 ? Math.round((f.paid / f.total) * 100) : 0;
        const clickable = Boolean(onSelectFloor && typeof f.floorNumber === 'number');
        const content = (
          <>
            <span className="w-12 font-mono font-semibold text-slate-600 dark:text-slate-300 shrink-0">
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
            <span
              className={`w-20 text-end font-mono text-[11px] font-bold shrink-0 whitespace-nowrap ${
                pct < 100 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {f.paid}/{f.total} ({pct}%)
            </span>
          </>
        );

        if (clickable) {
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => onSelectFloor?.(f.floorNumber as number, f.paid, f.total)}
              className="w-full flex items-center gap-3 text-xs px-2 py-1 -mx-2 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group text-start"
            >
              {content}
            </button>
          );
        }

        return (
          <div key={f.label} className="flex items-center gap-3 text-xs py-1">
            {content}
          </div>
        );
      })}
    </div>
  );
};
