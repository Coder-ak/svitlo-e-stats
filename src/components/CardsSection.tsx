import { useState } from "react";
import type { FC } from "react";
import { CARD_SETS, CARD_TABS } from "../data/cards";

const CardsSection: FC = () => {
  const [activeTab, setActiveTab] = useState(
    CARD_TABS[0]?.id ?? "overview",
  );
  const cards = CARD_SETS[activeTab] ?? [];

  return (
    <section className="section fade-in delay-2">
      <div className="panel-header">
        <div>
          <h2 className="section-title">Card snapshots</h2>
          <p className="section-subtitle">
            Placeholder cards wired for future endpoints. Switch between
            cohorts.
          </p>
        </div>
        <div className="tabs">
          {CARD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-button${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="cards-grid">
        {cards.map((card) => (
          <div key={card.id} className="card">
            <h3 className="card-title">{card.title}</h3>
            {card.type === "kv" && card.items ? (
              <ul className="kv-list">
                {card.items.map((item) => (
                  <li key={item.label} className="kv-item">
                    <span className="kv-label">{item.label}</span>
                    <span className="kv-value">{item.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {card.type === "table" && card.table ? (
              <div className="table">
                <div className="table-header">
                  {card.table.headers.map((header) => (
                    <span key={header}>{header}</span>
                  ))}
                </div>
                {card.table.rows.map((row, rowIndex) => (
                  <div key={`${card.id}-row-${rowIndex}`} className="table-row">
                    {row.map((cell, cellIndex) => (
                      <span key={`${card.id}-cell-${rowIndex}-${cellIndex}`}>
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
};

export default CardsSection;
