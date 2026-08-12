"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendPoint } from "@/lib/analytics/analytics";

interface SendTrendChartProps {
  data: TrendPoint[];
  height?: number;
}

/** Sent vs replied per day over the trailing window. */
export function SendTrendChart({ data, height = 256 }: SendTrendChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="repliedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value, name) => [
              value,
              name === "sent" ? "Sent" : "Replies",
            ]}
          />
          <Area
            type="monotone"
            dataKey="sent"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#sentGrad)"
          />
          <Area
            type="monotone"
            dataKey="replied"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#repliedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
