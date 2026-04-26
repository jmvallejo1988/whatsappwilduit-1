"use client";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error caught:", error);
  }, [error]);

  return (
    <div style={{
      padding: "20px",
      fontFamily: "monospace",
      background: "#111b21",
      color: "white",
      minHeight: "100vh",
    }}>
      <h2 style={{ color: "#ff4444", marginBottom: "12px" }}>⚠️ Error detectado</h2>
      <div style={{
        background: "#1a2530",
        border: "1px solid #ff4444",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
        fontSize: "13px",
        lineHeight: "1.6",
      }}>
        <strong style={{ color: "#ff6666" }}>Mensaje:</strong>
        <pre style={{ margin: "8px 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {error.message || "(sin mensaje)"}
        </pre>
        <strong style={{ color: "#ff6666" }}>Stack:</strong>
        <pre style={{ margin: "8px 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "11px", color: "#aaa" }}>
          {error.stack || "(sin stack)"}
        </pre>
        {error.digest && (
          <>
            <strong style={{ color: "#ff6666" }}>Digest:</strong>
            <pre style={{ margin: "8px 0" }}>{error.digest}</pre>
          </>
        )}
      </div>
      <button
        onClick={reset}
        style={{
          background: "#00a884",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        🔄 Reintentar
      </button>
    </div>
  );
}
