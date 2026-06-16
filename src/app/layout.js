import "./globals.css";

export const metadata = {
  title: "Gathering Gifts Photos",
  description: "Upload and organise event photos & video for Gathering Events.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
