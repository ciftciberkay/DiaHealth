import type { ReactNode } from "react";

export const metadata = {
  title: "diahealth admin",
  description: "Internal phase-1 admin shell"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#F5F7F6",
          color: "#1D3434"
        }}
      >
        {children}
      </body>
    </html>
  );
}
