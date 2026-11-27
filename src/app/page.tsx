"use client";

import { App } from "@/portagov/App";

/** The PortaGov Console front door (console.portagov.giin.co.rw) opens
    the platform view by default instead of the citizen home. Any link
    that already carries a page (for example #/signin) is left alone, so
    deep links and the back button keep working. The other doors
    (portagov.giin.co.rw and the Vercel previews) are untouched. This
    runs before the app mounts, so the first route is the platform
    view rather than a flash of the citizen home. */
function consoleDefaultPage(): void {
  try {
    if (typeof window === "undefined") return;
    if (window.location.hostname !== "console.portagov.giin.co.rw") return;
    if (window.location.hash.replace(/^#\/?/, "")) return;
    window.location.hash = "#/reports";
  } catch {
    /* Address bar unavailable in this shell; the citizen home stays. */
  }
}

/** The whole PortaGov site is one routed app: landing, ministries
    and services, citizen, institution, business and platform
    portals, sign in and first-time profile, tracking, wallet,
    embassies, assistant and staff. */
export default function Page() {
  consoleDefaultPage();
  return <App />;
}
