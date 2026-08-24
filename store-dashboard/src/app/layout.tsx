export const metadata = {
  title: "Zenddy Winkeldashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#f5f5f7",
          color: "#111",
        }}
      >
        <header
          style={{
            background: "#111",
            color: "#fff",
            padding: "16px 24px",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          Zenddy — Winkeldashboard
        </header>
        <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
