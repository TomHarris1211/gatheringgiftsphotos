import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata = {
  title: "Gathering Gifts Photos",
  description: "Upload and organise event photos & video for Gathering Events.",
  applicationName: "GG Photos",
  appleWebApp: {
    capable: true,
    title: "GG Photos",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#185FA5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
