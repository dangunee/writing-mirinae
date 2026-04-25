import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../lib/apiUrl";
import type { AuthMePayload, AuthRole } from "../../types/authMe";

/**
 * Top links for teacher routes. 「管理コンソール」 is hidden when /api/auth/me reports role `teacher` only.
 */
export function TeacherPageNav({ className }: { className?: string }) {
  const [role, setRole] = useState<AuthRole | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setRole(null);
          return;
        }
        const data = (await res.json()) as AuthMePayload;
        if (!data.ok) {
          setRole(null);
          return;
        }
        setRole(data.role ?? null);
      } catch {
        if (!cancelled) setRole(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showAdminLink = role !== "teacher";

  return (
    <nav className={`teacher-page-nav ${className ?? ""}`.trim()} aria-label="講師ナビ">
      <Link to="/writing/app" className="view-link">
        作文アプリ
      </Link>
      {showAdminLink ? (
        <Link to="/writing/admin" className="view-link">
          管理コンソール
        </Link>
      ) : null}
    </nav>
  );
}
