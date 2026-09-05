import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  PROVENANCE_CONTRACT_ID,
  PROVENANCE_WASM_HASH,
  stellarExpertContractUrl,
} from "../config.js";
import { truncateHash } from "./HashChip.js";

const REPO_URL = "https://github.com/Daraphista/acuris-stellar-poc";
const EVIDENCE_URL = `${REPO_URL}/blob/main/docs/evidence.md`;

const NAV = [
  { to: "/", label: "Console", end: true },
  { to: "/settlement", label: "Settlement", end: false },
  { to: "/provenance", label: "Provenance", end: false },
];

function breadcrumbFor(pathname: string): string {
  if (pathname.startsWith("/settlement")) return "Settlement";
  if (pathname.startsWith("/provenance")) return "Provenance";
  return "Console";
}

/**
 * Header, content column and footer.
 *
 * The footer is not chrome: it carries the contract address and WASM hash on every screen, so
 * whatever a visitor is looking at, the two identifiers that let them check it independently are
 * one glance away.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-50 h-12 shrink-0 flex items-center justify-between gap-space-base px-space-base bg-surface-container-lowest border-b border-outline-variant">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="font-headline-md text-headline-md text-primary">Acuris</span>
          <span className="font-code-compact text-code-compact text-outline-variant select-none">
            /
          </span>
          <span className="font-code-compact text-code-compact text-on-surface-variant truncate">
            {breadcrumbFor(pathname)}
          </span>
        </div>

        <div className="flex items-center gap-space-base">
          <nav className="hidden sm:flex items-center gap-space-md">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `font-code-compact text-code-compact pb-0.5 border-b transition-colors ${
                    isActive
                      ? "text-primary border-primary"
                      : "text-on-surface-variant border-transparent hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* States which network every value on the page comes from. Deliberately not a health
              indicator — the console index owns reachability, and a green dot here would imply
              something this component has not checked. */}
          <span className="px-space-sm py-0.5 rounded-sm bg-surface-container border border-outline-variant font-code-compact text-code-compact text-on-surface-variant shrink-0">
            Testnet
          </span>
        </div>
      </header>

      {/* Bottom padding clears the fixed footer. */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-space-base py-space-lg pb-20 flex flex-col gap-space-lg">
        {children}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between gap-space-sm px-space-base bg-surface-container-lowest border-t border-outline-variant font-code-micro text-code-micro text-on-surface-variant overflow-x-auto">
        <span className="whitespace-nowrap">
          contract{" "}
          <a
            className="hover:text-primary hover:underline transition-colors"
            href={stellarExpertContractUrl(PROVENANCE_CONTRACT_ID)}
            rel="noopener noreferrer"
            target="_blank"
            title={PROVENANCE_CONTRACT_ID}
          >
            {truncateHash(PROVENANCE_CONTRACT_ID)}
          </a>
          <span className="text-outline-variant select-none"> · </span>
          wasm{" "}
          <span className="text-on-surface" title={PROVENANCE_WASM_HASH}>
            {truncateHash(PROVENANCE_WASM_HASH)}
          </span>
        </span>

        <span className="flex items-center gap-space-md whitespace-nowrap">
          <a
            className="hover:text-primary hover:underline transition-colors"
            href={REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/Daraphista/acuris-stellar-poc
          </a>
          <span className="text-outline-variant select-none">·</span>
          <a
            className="hover:text-primary hover:underline transition-colors"
            href={EVIDENCE_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            docs/evidence.md
          </a>
        </span>
      </footer>
    </div>
  );
}
