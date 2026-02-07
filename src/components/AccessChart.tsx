import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { TYPE_LABELS } from "../const/typeLabels";
import { normalizeZoomRange, toEpochMs } from "../utils/time";

type AccessChartProps = {
  seriesData: Record<string, [number, number][]>;
  types: string[];
  rangeStart: number;
  endTime: number;
  xAxisLabelMode: "time" | "datetime" | "date";
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
const ZOOM_TITLE = "Zoom";
const RESET_ZOOM_TITLE = "Reset zoom";
const LINE_CHART_ICON =
  "M4.1,28.9h7.1l9.3-22l7.4,38l9.7-19.7l3,12.8h14.9M4.1,58h51.4";
const BAR_CHART_ICON =
  "M6.7,22.9h10V48h-10V22.9zM24.9,13h10v35h-10V13zM43.2,2h10v46h-10V2zM3.1,58h53.7";

function isResetZoomLabel(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase() === RESET_ZOOM_TITLE.toLowerCase()
  );
}

const sliderLabelDateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const xAxisTimeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const xAxisDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const AccessChart = ({
  seriesData,
  types,
  rangeStart,
  endTime,
  xAxisLabelMode,
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
  const [isZoomSelectActive, setIsZoomSelectActive] = useState(false);
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const isPointerDownRef = useRef(false);
  const pendingZoomRangeRef = useRef<{ startMs: number; endMs: number } | null>(
    null,
  );

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

    const series: echarts.SeriesOption[] = types.map((accessType) => {
      const color = TYPE_COLORS[accessType] || "#6b7280";
      const data = seriesData[accessType] || [];
      if (chartType === "bar") {
        const barSeries: echarts.BarSeriesOption = {
          name: accessType.toUpperCase(),
          type: "bar",
          stack: "total",
          data: data,
          itemStyle: { color: color },
          emphasis: {
            focus: "series",
          },
        };
        return barSeries;
      }

      const lineSeries: echarts.LineSeriesOption = {
        name: accessType.toUpperCase(),
        type: "line",
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
          focus: "series",
        },
      };
      return lineSeries;
    });
    const toggleChartTypeTitle = `Switch to ${chartType === "line" ? "bar" : "line"} chart`;
    const toggleChartTypeIcon =
      chartType === "line" ? BAR_CHART_ICON : LINE_CHART_ICON;

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
          formatter: (value: number) => {
            const date = new Date(value);
            if (xAxisLabelMode === "time") {
              return xAxisTimeFormat.format(date);
            }
            if (xAxisLabelMode === "date") {
              return xAxisDateFormat.format(date);
            }
            return dateTimeFormat.format(date);
          },
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
        iconStyle: {
          borderWidth: 1,
          borderColor: muted,
        },
        emphasis: {
          iconStyle: {
            borderWidth: 1,
            borderColor: TYPE_COLORS.cl,
            color: `${TYPE_COLORS.cl}22`,
          },
        },
        feature: {
          dataZoom: {
            yAxisIndex: "none",
            title: {
              zoom: ZOOM_TITLE,
              back: RESET_ZOOM_TITLE,
            },
            iconStyle: {
              textFill: TYPE_COLORS.cl,
            },
            emphasis: {
              iconStyle: {
                textFill: TYPE_COLORS.cl,
              },
            },
          },
          myChartType: {
            show: true,
            title: toggleChartTypeTitle,
            icon: `path://${toggleChartTypeIcon}`,
            onclick: () =>
              setChartType((previousType) =>
                previousType === "line" ? "bar" : "line",
              ),
            iconStyle: {
              textFill: TYPE_COLORS.cl,
            },
            emphasis: {
              iconStyle: {
                textFill: TYPE_COLORS.cl,
              },
            },
          },
          saveAsImage: {
            iconStyle: {
              textFill: TYPE_COLORS.cl,
            },
            emphasis: {
              iconStyle: {
                textFill: TYPE_COLORS.cl,
              },
            },
          },
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
          labelFormatter: (value: number | string) => {
            const valueMs = toEpochMs(value);
            if (valueMs == null) {
              return "";
            }
            return sliderLabelDateTimeFormat.format(new Date(valueMs));
          },
          zoomLock: true,
        },
      ],
      series: series,
    };

    instance.setOption(option);

    // keep toolbox select zoom in sync so "back" restores the current window baseline.
    const currentOption = instance.getOption() as {
      dataZoom?:
        | Array<{
            id?: string;
            type?: string;
          }>
        | {
            id?: string;
            type?: string;
          };
    };
    const zoomItems = Array.isArray(currentOption.dataZoom)
      ? currentOption.dataZoom
      : currentOption.dataZoom
        ? [currentOption.dataZoom]
        : [];
    const toolboxSelectZoom = zoomItems.find((item) => item.type === "select");
    if (toolboxSelectZoom?.id) {
      instance.setOption(
        {
          dataZoom: [
            {
              id: toolboxSelectZoom.id,
              startValue: rangeStart,
              endValue: endTime,
            },
          ],
        },
        { lazyUpdate: true, silent: true },
      );
    }

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

    const handleToolboxClick = (params: unknown) => {
      if (!params || typeof params !== "object") {
        return;
      }
      const payload = params as {
        componentType?: string;
        name?: string;
      };
      if (payload.componentType !== "toolbox") {
        return;
      }
      if (payload.name !== "back" && !isResetZoomLabel(payload.name)) {
        return;
      }
      instance.dispatchAction({
        type: "takeGlobalCursor",
        key: "dataZoomSelect",
        dataZoomSelectActive: false,
      });
      setIsZoomSelectActive(false);
    };
    const handleZrClick = (params: unknown) => {
      if (!params || typeof params !== "object") {
        return;
      }
      let target = (params as { target?: unknown }).target as
        | { __title?: string; parent?: unknown }
        | undefined;
      while (target) {
        if (isResetZoomLabel(target.__title)) {
          instance.dispatchAction({
            type: "takeGlobalCursor",
            key: "dataZoomSelect",
            dataZoomSelectActive: false,
          });
          setIsZoomSelectActive(false);
          break;
        }
        target = target.parent as
          | { __title?: string; parent?: unknown }
          | undefined;
      }
    };

    const zr = instance.getZr();

    instance.on("legendselectchanged", handleLegendSelectChanged);
    instance.on("click", handleToolboxClick);
    zr?.on("click", handleZrClick);

    return () => {
      instance.off("legendselectchanged", handleLegendSelectChanged);
      instance.off("click", handleToolboxClick);
      zr?.off("click", handleZrClick);
    };
  }, [
    axisMax,
    axisMin,
    dateTimeFormat,
    endTime,
    maxRangeMs,
    minRangeMs,
    rangeStart,
    xAxisLabelMode,
    seriesData,
    theme,
    types,
    hiddenTypes,
    chartType,
  ]);

  useEffect(() => {
    const instance = chartInstanceRef.current;
    if (!instance) {
      return;
    }

    const handleGlobalCursorTaken = (event: unknown) => {
      if (!event || typeof event !== "object") {
        return;
      }
      const payload = event as {
        key?: string;
        dataZoomSelectActive?: boolean;
      };
      if (payload.key !== "dataZoomSelect") {
        return;
      }
      setIsZoomSelectActive(payload.dataZoomSelectActive === true);
    };

    instance.on("globalCursorTaken", handleGlobalCursorTaken);
    instance.on("globalcursortaken", handleGlobalCursorTaken);

    return () => {
      instance.off("globalCursorTaken", handleGlobalCursorTaken);
      instance.off("globalcursortaken", handleGlobalCursorTaken);
    };
  }, []);

  useEffect(() => {
    const instance = chartInstanceRef.current;
    if (!instance) {
      return;
    }

    const flushPendingZoom = () => {
      const pendingRange = pendingZoomRangeRef.current;
      if (!pendingRange) {
        return;
      }
      pendingZoomRangeRef.current = null;
      onZoomRange(pendingRange.startMs, pendingRange.endMs);
    };

    const zr = instance.getZr();
    const handlePointerDown = () => {
      isPointerDownRef.current = true;
    };
    const handlePointerUp = () => {
      if (!isPointerDownRef.current) {
        return;
      }
      isPointerDownRef.current = false;
      flushPendingZoom();
    };

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
      if (isPointerDownRef.current) {
        pendingZoomRangeRef.current = normalizedRange;
        return;
      }
      onZoomRange(normalizedRange.startMs, normalizedRange.endMs);
    };

    instance.on("dataZoom", handleZoom);
    zr?.on("mousedown", handlePointerDown);
    zr?.on("mouseup", handlePointerUp);
    zr?.on("globalout", handlePointerUp);
    zr?.on("touchstart", handlePointerDown);
    zr?.on("touchend", handlePointerUp);

    return () => {
      instance.off("dataZoom", handleZoom);
      zr?.off("mousedown", handlePointerDown);
      zr?.off("mouseup", handlePointerUp);
      zr?.off("globalout", handlePointerUp);
      zr?.off("touchstart", handlePointerDown);
      zr?.off("touchend", handlePointerUp);
    };
  }, [axisMax, axisMin, minRangeMs, onZoomRange]);

  return (
    <div
      ref={chartRef}
      className={`chart-canvas${isZoomSelectActive ? " zoom-select-active" : ""}`}
    />
  );
};

export default AccessChart;
