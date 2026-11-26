"use client";

import { App } from "@/portagov/App";

/** The whole PortaGov site is one routed app: landing, ministries
    and services, citizen, institution, business and platform
    portals, sign in and first-time profile, tracking, wallet,
    embassies, assistant and staff. */
export default function Page() {
  return <App />;
}
