import type { IncomingMessage } from "http";

export type TrialBffOp = "session_current" | "access_consume" | "start_link" | "reissue_link";

/** Vercel rewrite 先の ?op= を解決（外部 URL は変更しない） */
export function parseTrialBffOp(req: IncomingMessage): TrialBffOp | null {
  const u = req.url ?? "";
  const q = u.includes("?") ? u.split("?")[1] : "";
  const params = new URLSearchParams(q);
  const op = params.get("op")?.trim();
  if (op === "session_current" || op === "access_consume" || op === "start_link" || op === "reissue_link") {
    return op;
  }
  return null;
}
