"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { TAGS } from "@/lib/tags";

export default function AdminDashboard() {
  const router = useRouter();
  const [media, setMedia] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [client, setClient] = useState("");
  const [uploader, setUploader] = useState("");
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (client) params.set("client", client);
    if (uploader) params.set("uploader", uploader);
    if (tag) params.set("tag", tag);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
    const res = await fetch("/api/media?" + params.toString());
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const data = await res.json();
    setMedia(data.media || []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, uploader, tag, from, to]);

  const filtered = useMemo(() => {
    if (!search.trim()) return media;
    const s = search.toLowerCase();
    return media.filter(
      (m) =>
        m.client_name?.toLowerCase().includes(s) ||
        m.uploader_name?.toLowerCase().includes(s) ||
        (m.tags || []).some((t) => t.toLowerCase().includes(s))
    );
  }, [media, search]);

  const stats = useMemo(() => {
    const videos = filtered.filter((m) => m.media_type === "video").length;
    return {
      total: filtered.length,
      clients: new Set(filtered.map((m) => m.client_id)).size,
      videos,
      photos: filtered.length - videos,
    };
  }, [filtered]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main style={d.wrap}>
      <header style={d.header}>
        <strong style={{ fontSize: 15 }}>📊 Admin dashboard</strong>
        <button style={d.signout} onClick={signOut}>Sign out</button>
      </header>

      <div style={d.filters}>
        <select style={d.field} value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input style={d.field} placeholder="Uploader" value={uploader} onChange={(e) => setUploader(e.target.value)} />
        <select style={d.field} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input style={d.field} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input style={d.field} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <input style={{ ...d.field, flex: 1, minWidth: 120 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={d.kpis}>
        <Kpi label="Media" value={stats.total} />
        <Kpi label="Clients" value={stats.clients} />
        <Kpi label="Videos" value={stats.videos} />
        <Kpi label="Photos" value={stats.photos} />
      </div>

      {loading ? (
        <p style={{ padding: 16, color: "#778" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ padding: 16, color: "#778" }}>No media matches these filters.</p>
      ) : (
        <div style={d.grid}>
          {filtered.map((m) => (
            <a key={m.id} href={m.public_url} target="_blank" rel="noreferrer" style={d.cell}>
              {m.media_type === "video" ? (
                <video src={m.public_url} style={d.cellMedia} muted />
              ) : (
                <img src={m.public_url} alt="" style={d.cellMedia} loading="lazy" />
              )}
              <div style={d.cellOverlay}>
                <span style={d.up}>{m.uploader_name}</span>
                <span style={d.cl}>{m.client_name}</span>
                <div style={d.tagRow}>
                  {m.media_type === "video" && <span style={d.play}>▶</span>}
                  {(m.tags || []).slice(0, 3).map((t) => <span key={t} style={d.tagPill}>{t}</span>)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={d.kpi}>
      <div style={{ fontSize: 12, color: "#778" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{Number(value).toLocaleString()}</div>
    </div>
  );
}

const d = {
  wrap: { maxWidth: 1100, margin: "0 auto", background: "#fff", minHeight: "100dvh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #eee", position: "sticky", top: 0, background: "#fff", zIndex: 5 },
  signout: { border: "1px solid #d8dce2", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" },
  filters: { display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 16px", borderBottom: "1px solid #eee" },
  field: { height: 36, border: "1px solid #d8dce2", borderRadius: 8, padding: "0 10px", fontSize: 13, background: "#fff", outline: "none" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, padding: "14px 16px" },
  kpi: { background: "#f4f6f8", borderRadius: 10, padding: "10px 12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, padding: 16 },
  cell: { position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#eef", textDecoration: "none", display: "block" },
  cellMedia: { width: "100%", height: "100%", objectFit: "cover" },
  cellOverlay: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 8, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 55%)" },
  up: { color: "#fff", fontSize: 11, fontWeight: 600 },
  cl: { color: "#dde", fontSize: 11 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, alignItems: "center" },
  play: { color: "#fff", fontSize: 11 },
  tagPill: { background: "rgba(255,255,255,0.92)", color: "#0C447C", fontSize: 9, padding: "1px 6px", borderRadius: 8 },
};
