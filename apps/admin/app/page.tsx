"use client";

import { useEffect, useMemo, useState } from "react";

const card = {
  background: "#FFFFFF",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 16px 40px rgba(9, 48, 39, 0.08)"
};
const phaseThreeModules = [
  {
    title: "Recipe Library",
    status: "Mobile Ready",
    detail: "Meal-time filters, calories, carbohydrates, ingredients, and preparation steps."
  },
  {
    title: "Mini Guides",
    status: "Mobile Ready",
    detail: "Hypoglycemia, eating out, stress, illness, sleep, and exercise guidance."
  },
  {
    title: "PDF Reports",
    status: "Mobile Ready",
    detail: "Local tracking history is exported into a shareable PDF report."
  },
  {
    title: "Content Operations",
    status: "Admin Placeholder",
    detail: "Future staff workflow for editing recipes and guides."
  }
];

export default function AdminHomePage() {
  const [passcode, setPasscode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const expected = useMemo(() => process.env.NEXT_PUBLIC_ADMIN_PLACEHOLDER_CODE ?? "diahealth-internal", []);

  useEffect(() => {
    setAuthenticated(window.sessionStorage.getItem("diahealth.admin") === "true");
  }, []);

  const handleLogin = () => {
    const okay = passcode === expected;
    setAuthenticated(okay);

    if (okay) {
      window.sessionStorage.setItem("diahealth.admin", "true");
    }
  };

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 32, display: "grid", gap: 20 }}>
      <section style={{ ...card, background: "linear-gradient(135deg, #10493D, #2B8671)", color: "#FFFFFF" }}>
        <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7 }}>diahealth internal</p>
        <h1 style={{ marginBottom: 8 }}>Phase 1 admin shell</h1>
        <p style={{ margin: 0, maxWidth: 640 }}>
          This shell is intentionally narrow. It exists to validate internal access, roadmap visibility, and future operational entry points.
        </p>
      </section>

      {!authenticated ? (
        <section style={card}>
          <h2>Internal access placeholder</h2>
          <p>Use a temporary passcode until real staff authentication is implemented.</p>
          <input
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            type="password"
            placeholder="Internal passcode"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #D4DEDA",
              marginBottom: 12
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              border: 0,
              borderRadius: 14,
              padding: "14px 18px",
              background: "#1B6C5B",
              color: "#FFFFFF",
              fontWeight: 700
            }}
          >
            Enter admin
          </button>
        </section>
      ) : (
        <>
          <section style={card}>
            <h2>Operational modules</h2>
            <ul>
              <li>Auth and role placeholder</li>
              <li>Recipes content queue placeholder</li>
              <li>Guides publishing placeholder</li>
              <li>Community moderation placeholder</li>
            </ul>
          </section>
          <section style={card}>
            <h2>Phase 1 readiness</h2>
            <ul>
              <li>Shared contracts in monorepo</li>
              <li>Backend profile and sync routes</li>
              <li>Mobile onboarding and local-first tracking</li>
              <li>Admin shell ready for later feature expansion</li>
            </ul>
          </section>
          <section style={card}>
            <h2>Phase 3 content operations</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {phaseThreeModules.map((item) => (
                <article
                  key={item.title}
                  style={{
                    border: "1px solid #D4DEDA",
                    borderRadius: 16,
                    padding: 16,
                    background: "#F5F7F6"
                  }}
                >
                  <strong>{item.title}</strong>
                  <p style={{ color: "#1B6C5B", fontWeight: 700 }}>{item.status}</p>
                  <p style={{ marginBottom: 0 }}>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
