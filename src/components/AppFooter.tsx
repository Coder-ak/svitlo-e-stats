import type { FC } from "react";

type AppFooterProps = {
  latestSampleLabel: string;
  cacheSize: number;
};

const AppFooter: FC<AppFooterProps> = ({ latestSampleLabel, cacheSize }) => {
  return (
    <footer className="app-footer">
      <div className="container footer-row">
        <span>Last sample: {latestSampleLabel}</span>
        <span>Cached windows: {cacheSize}</span>
      </div>
    </footer>
  );
};

export default AppFooter;
