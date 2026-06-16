"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main style={st.wrap}>
      <form style={st.card} onSubmit={signIn}>
        <h1 style={st.title}>Gathering Gifts Photos</h1>
        <p style={st.sub}>Admin sign in</p>
        <input style={st.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={st.input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={st.err}>{error}</p>}
        <button style={st.btn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <a href="/" style={st.back}>← Back to upload</a>
      </form>
    </main>
  );
}

const st = {
  wrap: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 14, border: "1px solid #eee", padding: 24, display: "flex", flexDirection: "column" },
  title: { fontSize: 18, margin: 0, fontWeight: 600 },
  sub: { color: "#778", margin: "4px 0 18px", fontSize: 14 },
  input: { height: 46, border: "1px solid #d8dce2", borderRadius: 10, padding: "0 12px", fontSize: 16, marginBottom: 12, outline: "none" },
  btn: { height: 48, border: "none", borderRadius: 10, background: "#185FA5", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  err: { color: "#A32D2D", fontSize: 13, margin: "0 0 10px" },
  back: { textAlign: "center", marginTop: 16, color: "#889", fontSize: 13, textDecoration: "none" },
};
