import { redirect } from "next/navigation";

/** Root `/` — SPA lives at `/writing/*` (Vite output in public/). */
export default function RootPage() {
  redirect("/writing");
}
