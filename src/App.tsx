import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import "./App.less";
import AppHeader from "./components/AppHeader";
import TotalsSection from "./components/TotalsSection";
import ChartSection from "./components/ChartSection";
import CardsSection from "./components/CardsSection";
import AppFooter from "./components/AppFooter";
import { SummaryProvider } from "./context/SummaryProvider";

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "light";
  });
  const [latestSampleLabel, setLatestSampleLabel] = useState("--");
  const [cacheSize, setCacheSize] = useState(0);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const handleChartMetaChange = useCallback(
    (meta: { latestSampleLabel: string; cacheSize: number }) => {
      setLatestSampleLabel(meta.latestSampleLabel);
      setCacheSize(meta.cacheSize);
    },
    [],
  );

  return (
    <SummaryProvider>
      <div className="app">
        <AppHeader theme={theme} onToggle={handleThemeToggle} />

        <main className="app-main">
          <TotalsSection />
          <ChartSection theme={theme} onMetaChange={handleChartMetaChange} />
          <CardsSection />
        </main>

        <AppFooter
          latestSampleLabel={latestSampleLabel}
          cacheSize={cacheSize}
        />
      </div>
    </SummaryProvider>
  );
}

export default App;
