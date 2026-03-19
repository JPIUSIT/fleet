import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

export default function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch(console.error);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1d5c52 0%, #2a7d6f 60%, #4db6a4 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "48px 40px",
        maxWidth: 400,
        width: "90%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Logo */}
        <div style={{
          width: 72, height: 72,
          background: "linear-gradient(135deg, #2a7d6f, #4db6a4)",
          borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 24, fontWeight: 700, color: "#fff",
          boxShadow: "0 4px 16px rgba(42,125,111,0.4)",
        }}>J+S</div>

        <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "#1a2e2b" }}>Fleet Manager</h1>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "#6b7f7c" }}>
          Gestione Parco Auto Aziendale
        </p>

        <button onClick={handleLogin} style={{
          width: "100%",
          padding: "14px 20px",
          background: "#0078d4",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          boxShadow: "0 4px 12px rgba(0,120,212,0.3)",
          transition: "background 0.2s",
        }}
          onMouseOver={e => e.currentTarget.style.background = "#106ebe"}
          onMouseOut={e => e.currentTarget.style.background = "#0078d4"}
        >
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Accedi con Microsoft
        </button>

        <p style={{ marginTop: 24, fontSize: 12, color: "#aaa" }}>
          Usa il tuo account aziendale per accedere.<br/>
          I permessi vengono assegnati automaticamente.
        </p>
      </div>
    </div>
  );
}