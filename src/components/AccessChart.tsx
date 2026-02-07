import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { TYPE_LABELS } from "../const/typeLabels";
import { normalizeZoomRange, toEpochMs } from "../utils/time";

type AccessChartProps = {
  seriesData: Record<string, [number, number][]>;
  types: string[];
  rangeStart: number;
  endTime: number;
  axisMin?: number;
  axisMax?: number;
  minRangeMs: number;
  maxRangeMs: number;
  theme: "light" | "dark";
  dateTimeFormat: Intl.DateTimeFormat;
  onZoomRange: (startMs: number, endMs: number) => void;
};

const TYPE_COLORS: Record<string, string> = {
  na: "#8b5cf6",
  cl: "#3b82f6",
  cs: "#06b6d4",
  ql: "#10b981",
  qs: "#f59e0b",
  qi: "#ef4444",
};

const AccessChart = ({
  seriesData,
  types,
  rangeStart,
  endTime,
  axisMin,
  axisMax,
  minRangeMs,
  maxRangeMs,
  theme,
  dateTimeFormat,
  onZoomRange,
}: AccessChartProps) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }
    const instance = echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
    });
    chartInstanceRef.current = instance;

    const handleResize = () => instance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      instance.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = chartInstanceRef.current;
    if (!instance) {
      return;
    }

    const rootStyles = getComputedStyle(document.documentElement);
    const text = rootStyles.getPropertyValue("--text").trim();
    const muted = rootStyles.getPropertyValue("--muted").trim();
    const border = rootStyles.getPropertyValue("--border").trim();
    const bgAlt = rootStyles.getPropertyValue("--bg-alt").trim();
    const gridLine = rootStyles.getPropertyValue("--grid-line").trim();

    const series = types.map((accessType) => {
      const color = TYPE_COLORS[accessType] || "#6b7280";
      const data = seriesData[accessType] || [];

      return {
        name: accessType.toUpperCase(),
        type: "line" as const,
        stack: "total",
        data: data,
        showSymbol: false,
        lineStyle: { width: 0 },
        areaStyle: {
          color: color,
          opacity: hiddenTypes.has(accessType) ? 0 : 0.7,
        },
        itemStyle: { color: color },
        emphasis: {
          focus: "series" as const,
        },
      };
    });

    type TooltipItem = {
      value: unknown;
      marker?: string;
      seriesName?: string;
      axisValue?: string | number;
    };

    const option: echarts.EChartsOption = {
      animation: false,
      textStyle: {
        color: text,
        fontFamily: "IBM Plex Mono, Menlo, monospace",
      },
      grid: {
        left: 26,
        right: 26,
        top: 40,
        bottom: 48,
        containLabel: true,
      },
      legend: {
        top: 8,
        right: 24,
        textStyle: {
          color: text,
          fontFamily: "IBM Plex Mono, Menlo, monospace",
          fontSize: 11,
        },
        itemWidth: 12,
        itemHeight: 12,
        selected: Object.fromEntries(
          types.map((type) => [type.toUpperCase(), !hiddenTypes.has(type)]),
        ),
        tooltip: {
          show: true,
          formatter: (params) => {
            const { name } = params;
            return TYPE_LABELS[name?.toLowerCase()] || "";
          },
        },
      },
      tooltip: {
        trigger: "axis",
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bgAlt,
        textStyle: {
          color: text,
          fontFamily: "IBM Plex Mono, Menlo, monospace",
          fontSize: 11,
        },
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]).filter(
            (item) => item != null,
          ) as TooltipItem[];
          if (items.length === 0) return "";

          const first = items[0];
          const rawAxisValue = first.axisValue ?? first.value;
          const timeMs = toEpochMs(rawAxisValue);
          const formattedTime =
            timeMs != null ? dateTimeFormat.format(new Date(timeMs)) : "";

          let total = 0;
          const lines = items.reduce<string[]>((acc, item) => {
            const value = Array.isArray(item.value)
              ? item.value[1]
              : item.value;
            if (
              typeof value !== "number" ||
              !Number.isFinite(value) ||
              value <= 0
            ) {
              return acc;
            }
            total += value;
            acc.push(`${item.marker ?? ""} ${item.seriesName ?? ""}: ${value}`);
            return acc;
          }, []);

          return `<div style="font-weight: 600; margin-bottom: 4px;">${formattedTime}</div>
                  <div style="color: ${muted}; margin-bottom: 4px;">Total: ${total}</div>
                  ${lines.join("<br/>")}`;
        },
      },
      xAxis: {
        type: "time",
        min: axisMin,
        max: axisMax,
        axisLine: { lineStyle: { color: border } },
        axisTick: { lineStyle: { color: border } },
        axisLabel: {
          color: muted,
          fontSize: 11,
          formatter: (value: number) => dateTimeFormat.format(new Date(value)),
        },
        splitLine: {
          show: true,
          lineStyle: { color: gridLine },
        },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: border } },
        axisLabel: {
          color: muted,
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: gridLine } },
      },
      toolbox: {
        show: true,
        orient: "vertical",
        right: -16,
        top: 20,
        feature: {
          dataZoom: {
            yAxisIndex: "none",
          },
          magicType: {
            type: ["line", "bar"],
          },
          saveAsImage: {},
        },
      },
      dataZoom: [
        {
          type: "inside",
          startValue: rangeStart,
          endValue: endTime,
          minValueSpan: minRangeMs,
          maxValueSpan: maxRangeMs,
          zoomOnMouseWheel: false,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          startValue: rangeStart,
          endValue: endTime,
          minValueSpan: minRangeMs,
          maxValueSpan: maxRangeMs,
          height: 26,
          bottom: 12,
          borderColor: border,
          backgroundColor: bgAlt,
          fillerColor: TYPE_COLORS.cl + "40",
          handleStyle: { color: TYPE_COLORS.cl },
          textStyle: { color: muted, fontSize: 10 },
        },
      ],
      series: series,
    };

    instance.setOption(option, true);

    const handleLegendSelectChanged = (params: unknown) => {
      if (!params || typeof params !== "object") {
        return;
      }
      const selection = params as { selected?: Record<string, boolean> };
      if (!selection.selected) {
        return;
      }
      const newHidden = new Set<string>();
      types.forEach((type) => {
        if (!selection.selected?.[type.toUpperCase()]) {
          newHidden.add(type);
        }
      });
      setHiddenTypes(newHidden);
    };

    instance.on("legendselectchanged", handleLegendSelectChanged);

    return () => {
      instance.off("legendselectchanged", handleLegendSelectChanged);
    };
  }, [
    axisMax,
    axisMin,
    dateTimeFormat,
    endTime,
    maxRangeMs,
    minRangeMs,
    rangeStart,
    seriesData,
    theme,
    types,
    hiddenTypes,
  ]);

  useEffect(() => {
    const instance = chartInstanceRef.current;
    if (!instance) {
      return;
    }

    const handleZoom = (event: unknown) => {
      if (!event || typeof event !== "object") {
        return;
      }
      const payload = event as {
        start?: number;
        end?: number;
        startValue?: number;
        endValue?: number;
        batch?: Array<{
          start?: number;
          end?: number;
          startValue?: number;
          endValue?: number;
        }>;
      };
      const zoom = payload.batch?.[0];
      const resolveValue = (value: unknown) => {
        if (typeof value === "number") {
          if (
            axisMin != null &&
            axisMax != null &&
            value >= 0 &&
            value <= 100
          ) {
            return axisMin + ((axisMax - axisMin) * value) / 100;
          }
          if (
            axisMin == null &&
            axisMax == null &&
            value >= 0 &&
            value <= 100
          ) {
            return undefined;
          }
        }
        return toEpochMs(value);
      };
      const startValue =
        zoom?.startValue ?? payload.startValue ?? zoom?.start ?? payload.start;
      const endValue =
        zoom?.endValue ?? payload.endValue ?? zoom?.end ?? payload.end;
      const payloadRange = normalizeZoomRange(
        resolveValue(startValue),
        resolveValue(endValue),
      );
      const option = instance.getOption() as {
        dataZoom?:
          | Array<{
              type?: string;
              start?: number;
              end?: number;
              startValue?: number;
              endValue?: number;
            }>
          | {
              type?: string;
              start?: number;
              end?: number;
              startValue?: number;
              endValue?: number;
            };
      };
      const zoomItems = Array.isArray(option.dataZoom)
        ? option.dataZoom
        : option.dataZoom
          ? [option.dataZoom]
          : [];
      const zoomOption =
        zoomItems.find((item) => item.type === "slider") ?? zoomItems[0];
      const optionRange = normalizeZoomRange(
        resolveValue(zoomOption?.startValue ?? zoomOption?.start),
        resolveValue(zoomOption?.endValue ?? zoomOption?.end),
      );
      const normalizedRange = (() => {
        if (payloadRange && optionRange) {
          const payloadSpan = payloadRange.endMs - payloadRange.startMs;
          const optionSpan = optionRange.endMs - optionRange.startMs;
          if (payloadSpan < minRangeMs && optionSpan >= minRangeMs) {
            return optionRange;
          }
          if (optionSpan < minRangeMs && payloadSpan >= minRangeMs) {
            return payloadRange;
          }
        }
        return payloadRange ?? optionRange;
      })();
      if (!normalizedRange) {
        return;
      }
      onZoomRange(normalizedRange.startMs, normalizedRange.endMs);
    };

    instance.on("dataZoom", handleZoom);

    return () => {
      instance.off("dataZoom", handleZoom);
    };
  }, [axisMax, axisMin, minRangeMs, onZoomRange]);

  return <div ref={chartRef} className="chart-canvas" />;
};

export default AccessChart;
