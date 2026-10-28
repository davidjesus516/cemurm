import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { DashboardCard } from "../../shared/dashboard-card";
import type { ChartPoint, PeriodStats } from "@/hooks/shared/useAdminOverview";

interface TotalSalesProps {
  chartData: ChartPoint[];
  stats: PeriodStats;
}

  // V1/S1: the template coloured the second series by mixing 60% of primary
  // with transparency through a banned functional colour (gate rule 01a). It
  // is re-anchored on the palette's amber token directly; the 60%-muted
  // companion rendering is retired (S4 delta, documented in the Log).
  const chartConfig = {
  songs: { label: "Songs", color: "var(--color-cem-amber)" },
  setlists: { label: "Setlists", color: "var(--color-cem-amber)" },
} satisfies ChartConfig;

function useAnimatedNumber(target: number, duration = 450) {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = currentRef.current;
    const diff = target - from;
    if (diff === 0) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + diff * eased);
      currentRef.current = next;
      setDisplay(next);
      if (progress < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { currentRef.current = target; setDisplay(target); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return display;
}

function AnimatedValue({ value }: { value: number }) {
  const animated = useAnimatedNumber(value);
  return <>{animated.toLocaleString()}</>;
}

type TooltipItem = { name?: string; value?: number; color?: string; dataKey?: string; type?: string };
type ConfigEntry = { label?: string; color?: string };

function AnimatedTooltipContent({ active, payload, label, hideLabel = false, config }: {
  active?: boolean; payload?: TooltipItem[]; label?: string;
  hideLabel?: boolean; config?: Record<string, ConfigEntry>;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((item) => item.type !== "none" && item.value !== undefined);
  if (!items.length) return null;
  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-cem-hover/50 bg-cem-base px-2.5 py-1.5 text-xs shadow-xl">
      {!hideLabel && label && <div className="font-medium">{label}</div>}
      <div className="grid gap-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex w-full items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span className="text-cem-secondary-elevated">{config?.[item.dataKey ?? ""]?.label ?? item.name}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-cem-text">
              <AnimatedValue value={item.value as number} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function deltaLabel(value: number | null): string | null {
  if (value === null) return null;
  if (value === 0) return "no change";
  return `${value > 0 ? "+" : ""}${value}%`;
}

export default function TotalSales({ chartData, stats }: TotalSalesProps) {
  const maxValue = Math.max(
    4,
    ...chartData.map((point) => Math.max(point.songs, point.setlists)),
  );

  return (
    <DashboardCard className="flex flex-col gap-0!">
      {/* Header */}
      <CardHeader className="border-b border-cem-hover">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={16} className="text-cem-secondary-elevated" />
          Repertoire activity
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 flex flex-col gap-6">
        {/* Stats row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-base font-normal text-cem-text leading-6">Songs added</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-semibold tracking-[-0.3px] text-cem-text leading-8">
                {stats.songs.toLocaleString()}
              </span>
              {stats.songDelta === null ? (
                <span className="text-sm font-normal text-cem-secondary-elevated">new this period</span>
              ) : (
                <>
                  <span
                    className={`text-sm font-medium ${stats.songDelta >= 0 ? 'text-success' : 'text-destructive'}`}
                  >
                    {deltaLabel(stats.songDelta)}
                  </span>
                  <span className="text-sm font-normal text-cem-secondary-elevated">vs previous period</span>
                </>
              )}
            </div>
            <span className="text-sm font-normal text-cem-secondary-elevated">
              {stats.setlists.toLocaleString()} {stats.setlists === 1 ? 'setlist' : 'setlists'} created
              {stats.setlistDelta !== null && stats.setlistDelta !== 0
                ? ` · ${deltaLabel(stats.setlistDelta)} vs previous period`
                : ''}
            </span>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[215px]! w-full">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 30, bottom: 0, left: -10 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--color-cem-hover)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={32}
              tick={{ fontSize: 12, fill: "var(--color-cem-secondary-elevated)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--color-cem-secondary-elevated)" }}
              domain={[0, maxValue]}
              tickCount={5}
            />
            <ChartTooltip
              cursor={{
                stroke: "var(--color-cem-hover)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
              content={<AnimatedTooltipContent config={chartConfig} />}
            />
            {/* Songs — solid primary */}
            <Line
              dataKey="songs"
              type="linear"
              stroke="var(--color-cem-amber)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-cem-amber)", strokeWidth: 0 }}
              isAnimationActive
              animationBegin={0}
              animationDuration={700}
              animationEasing="ease-out"
            />
            {/* Setlists — dashed */}
            <Line
              dataKey="setlists"
              type="linear"
              stroke="var(--color-cem-amber)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-cem-amber)", strokeWidth: 0 }}
              isAnimationActive
              animationBegin={120}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </DashboardCard>
  );
}
