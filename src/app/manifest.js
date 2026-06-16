// Generates /manifest.webmanifest — Next links it automatically.
export default function manifest() {
  return {
    name: "Gathering Gifts Photos",
    short_name: "GG Photos",
    description: "Upload and organise event photos & video for Gathering Events.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#185FA5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
