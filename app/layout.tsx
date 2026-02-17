import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "writing.mirinae.jp | ミリネ韓国語教室・作文トレーニング",
  description: "ミリネ韓国語教室・作文トレーニング",
  metadataBase: new URL("https://writing.mirinae.jp"),
  openGraph: {
    title: "writing.mirinae.jp | ミリネ韓国語教室・作文トレーニング",
    url: "https://writing.mirinae.jp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
