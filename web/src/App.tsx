import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { Index } from "./routes/Index.js";
import { Settlement } from "./routes/Settlement.js";
import { Provenance } from "./routes/Provenance.js";

/**
 * The demo previously used `#settlement` / `#provenance` hash tabs, and those links are in the
 * README and in messages already sent to reviewers. They keep working.
 */
function LegacyHashRedirect() {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname !== "/") return;
    if (hash === "#settlement") navigate("/settlement", { replace: true });
    if (hash === "#provenance") navigate("/provenance", { replace: true });
  }, [hash, pathname, navigate]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <LegacyHashRedirect />
      <AppShell>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/settlement" element={<Settlement />} />
          <Route path="/provenance" element={<Provenance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
