import type { FC } from "react";

type AppHeaderProps = {
  theme: "light" | "dark";
  onToggle: () => void;
};

const AppHeader: FC<AppHeaderProps> = ({ theme, onToggle }) => {
  return (
    <header className="app-header">
      <div className="container header-row">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true" />
          <span>SvitloE Stats</span>
        </div>
        <div className="header-actions">
          <button type="button" className="theme-toggle" onClick={onToggle}>
            <span>{theme === "light" ? "Light" : "Dark"}</span>
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </button>
          <a
            className="icon-link"
            href="https://t.me/SvitloeRadujnyBot"
            target="_blank"
            rel="noreferrer"
            aria-label="Telegram"
          >
            <span className="icon-mark tg-mark" aria-hidden="true" />
          </a>
          <a
            className="icon-link"
            href="https://github.com/Coder-ak/"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <svg
              className="icon-mark"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3" />
              <path d="M16 22v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7a5.44 5.44 0 0 0-1.5-3.75 5.07 5.07 0 0 0-.09-3.75s-1.18-.38-3.88 1.47a13.38 13.38 0 0 0-7 0C6.32.62 5.14 1 5.14 1a5.07 5.07 0 0 0-.09 3.75A5.44 5.44 0 0 0 3.5 8.5c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
