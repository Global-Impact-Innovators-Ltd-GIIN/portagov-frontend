import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PortaGov - Citizens. Services. Connected.",
    short_name: "PortaGov",
    description:
      "Apply, pay, track and receive government documents from home, in Liberia and abroad.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f6",
    theme_color: "#0a2a5e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
