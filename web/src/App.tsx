import { useEffect, useState } from "react";
import { SettlementTab } from "./components/SettlementTab.js";
import { ProvenanceTab } from "./components/ProvenanceTab.js";

type TabId = "settlement" | "provenance";

function tabFromHash(): TabId {
  return window.location.hash === "#provenance" ? "provenance" : "settlement";
}

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function selectTab(next: TabId) {
    window.location.hash = next;
    setTab(next);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Acuris Stellar PoC — Testnet Demo</h1>
        <p>
          Live against Stellar Testnet. Source, evidence, and docs:{" "}
          <a href="https://github.com/Daraphista/acuris-stellar-poc" target="_blank" rel="noreferrer">
            github.com/Daraphista/acuris-stellar-poc
          </a>
        </p>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="tab-button"
          aria-selected={tab === "settlement"}
          onClick={() => selectTab("settlement")}
        >
          Settlement rail (D1)
        </button>
        <button
          type="button"
          role="tab"
          className="tab-button"
          aria-selected={tab === "provenance"}
          onClick={() => selectTab("provenance")}
        >
          Provenance (D2)
        </button>
      </div>

      {tab === "settlement" ? <SettlementTab /> : <ProvenanceTab />}

      <p className="footer-note">
        Acuris Med AI — Stellar Philippines Instawards. See{" "}
        <a href="https://github.com/Daraphista/acuris-stellar-poc/blob/main/docs/evidence.md" target="_blank" rel="noreferrer">
          docs/evidence.md
        </a>{" "}
        for the full transaction history behind this page.
      </p>
    </div>
  );
}
