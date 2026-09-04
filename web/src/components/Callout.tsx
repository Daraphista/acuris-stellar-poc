import type { ReactNode } from "react";

export function Callout({
  kind,
  children,
}: {
  kind: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  return <div className={`callout ${kind}`}>{children}</div>;
}
