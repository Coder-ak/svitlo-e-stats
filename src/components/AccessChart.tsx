import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { normalizeZoomRange, toEpochMs } from "../utils/time";

type AccessChartProps = {
  seriesData: [number, number][];
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

const AccessChart = ({
  seriesData,
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
    const accent = rootStyles.getPropertyValue("--accent").trim();
    const accentSoft = rootStyles.getPropertyValue("--accent-soft").trim();
    const bgAlt = rootStyles.getPropertyValue("--bg-alt").trim();
    const gridLine = rootStyles.getPropertyValue("--grid-line").trim();

    const option: echarts.EChartsOption = {
      animation: false,
      textStyle: {
        color: text,
        fontFamily: "IBM Plex Mono, Menlo, monospace",
      },
      grid: {
        left: 48,
        right: 24,
        top: 32,
        bottom: 48,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bgAlt,
        textStyle: {
          color: text,
          fontFamily: "IBM Plex Mono, Menlo, monospace",
        },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          const value = Array.isArray(point.value) ? point.value[1] : point.value;
          const axisValue = (point as { axisValue?: number | string }).axisValue;
          const timeValue = Array.isArray(point.value) ? point.value[0] : axisValue;
          const formattedTime = dateTimeFormat.format(new Date(Number(timeValue)));
          return `${formattedTime}<br/>${value} hits`;
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
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: gridLine } },
      },
      dataZoom: [
        {
          type: "inside",
          startValue: rangeStart,
          endValue: endTime,
          minValueSpan: minRangeMs,
          maxValueSpan: maxRangeMs,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
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
          fillerColor: accentSoft,
          handleStyle: { color: accent },
          textStyle: { color: muted },
        },
      ],
      series: [
        {
          type: "line",
          data: seriesData,
          showSymbol: false,
          lineStyle: { width: 2, color: accent },
          itemStyle: { color: accent },
          areaStyle: { color: accentSoft },
        },
      ],
    };

    instance.setOption(option, true);
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
          if (axisMin == null && axisMax == null && value >= 0 && value <= 100) {
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
