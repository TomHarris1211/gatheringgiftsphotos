"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { TAGS } from "@/lib/tags";

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

function fileNameFor(m) {
  const base = (m.r2_key || "").split("/").pop() || "media";
  const client = (m.client_name || "client").replace(/[^A-Za-z0-9]+/g, "-");
  return `${client}_${base}`;
}

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

  // edit modal state
  const [editing, setEditing] = useState(null); // media row or null
  const [eName, setEName] = useState("");
  const [eClient, setEClient] = useState("");
  const [eTags, setETags] = useState([]);
  const [eOther, setEOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

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

  async function del(id) {
    if (!confirm("Delete this item permanently? This removes it from storage too.")) return;
    const res = await fetch("/api/media?id=" + id, { method: "DELETE" });
    if (res.ok) setMedia((m) => m.filter((x) => x.id !== id));
    else alert("Could not delete. Please try again.");
  }

  async function download(m) {
    try {
      const res = await fetch(m.public_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFor(m);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(m.public_url, "_blank");
    }
  }

  async function downloadAll() {
    if (!filtered.length) return;
    if (!confirm(`Download all ${filtered.length} item(s) currently shown?`)) return;
    setDownloadingAll(true);
    for (const m of filtered) {
      await download(m);
      await new Promise((r) => setTimeout(r, 400)); // small gap so the browser keeps up
    }
    setDownloadingAll(false);
  }

  function openEdit(m) {
    setEditing(m);
    setEName(m.uploader_name || "");
    setEClient(m.client_name || "");
    const known = (m.tags || []).filter((t) => TAGS.includes(t));
    const custom = (m.tags || []).filter((t) => !TAGS.includes(t));
    setETags(known.concat(custom.length ? ["others"] : []));
    setEOther(custom.join(", "));
  }

  function toggleETag(t) {
    setETags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const finalTags = eTags.filter((t) => t !== "others");
    if (eTags.includes("others") && eOther.trim()) {
      eOther.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => finalTags.push(s));
    } else if (eTags.includes("others")) {
      finalTags.push("others");
    }
    const res = await fetch("/api/media?id=" + editing.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploaderName: eName, clientName: eClient, tags: finalTags }),
    });
    setSaving(false);
    if (!res.ok) { alert("Could not save changes."); return; }
    setEditing(null);
    load();
  }

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
    return { total: filtered.length, clients: new Set(filtered.map((m) => m.client_id)).size, videos, photos: filtered.length - videos };
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
        <div style={{ display: "flex", gap: 8 }}>
          <button style={d.signout} disabled={downloadingAll || !filtered.length} onClick={downloadAll}>
            {downloadingAll ? "Downloading…" : `⬇ Download all (${filtered.length})`}
          </button>
          <button style={d.signout} onClick={signOut}>Sign out</button>
        </div>
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
            <div key={m.id} style={d.cell} onClick={() => window.open(m.public_url, "_blank")}>
              {m.media_type === "video" ? (
                <video src={m.public_url} style={d.cellMedia} muted />
              ) : (
                <img src={m.public_url} alt="" style={d.cellMedia} loading="lazy" />
              )}
              <div style={d.btnRow} onClick={(e) => e.stopPropagation()}>
                <button style={d.iconBtn} title="Download" onClick={() => download(m)}>⬇</button>
                <button style={d.iconBtn} title="Edit" onClick={() => openEdit(m)}>✎</button>
                <button style={d.iconBtn} title="Delete" onClick={() => del(m.id)}>🗑</button>
              </div>
              <div style={d.cellOverlay}>
                <span style={d.up}>{m.uploader_name}</span>
                <span style={d.cl}>{m.client_name}</span>
                <span style={d.date}>{fmtDate(m.created_at)}</span>
                <div style={d.tagRow}>
                  {m.media_type === "video" && <span style={d.play}>▶</span>}
                  {(m.tags || []).slice(0, 3).map((t) => <span key={t} style={d.tagPill}>{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={d.modalBg} onClick={() => setEditing(null)}>
          <div style={d.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Edit item</h3>
            <label style={d.mLabel}>Uploader name</label>
            <input style={d.mInput} value={eName} onChange={(e) => setEName(e.target.value)} />
            <label style={d.mLabel}>Company / Client name</label>
            <input style={d.mInput} value={eClient} onChange={(e) => setEClient(e.target.value)} />
            <label style={d.mLabel}>Tags</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {TAGS.map((t) => (
                <button key={t} onClick={() => toggleETag(t)} style={{ ...d.chip, ...(eTags.includes(t) ? d.chipActive : {}) }}>{t}</button>
              ))}
            </div>
            {eTags.includes("others") && (
              <input style={d.mInput} placeholder="Specify (comma-separated)" value={eOther} onChange={(e) => setEOther(e.target.value)} />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={d.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
              <button style={d.saveBtn} disabled={saving} onClick={saveEdit}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
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
  cell: { position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#eef", cursor: "pointer" },
  cellMedia: { width: "100%", height: "100%", objectFit: "cover" },
  btnRow: { position: "absolute", top: 6, right: 6, display: "flex", gap: 4, zIndex: 2 },
  iconBtn: { width: 28, height: 28, border: "none", borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  cellOverlay: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 8, background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent 55%)", pointerEvents: "none" },
  up: { color: "#fff", fontSize: 11, fontWeight: 600 },
  cl: { color: "#dde", fontSize: 11 },
  date: { color: "#ccd", fontSize: 10, marginTop: 1 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, alignItems: "center" },
  play: { color: "#fff", fontSize: 11 },
  tagPill: { background: "rgba(255,255,255,0.92)", color: "#0C447C", fontSize: 9, padding: "1px 6px", borderRadius: 8 },
  modalBg: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modal: { background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 380 },
  mLabel: { display: "block", fontSize: 12, color: "#556", margin: "10px 0 5px", fontWeight: 500 },
  mInput: { width: "100%", height: 42, border: "1px solid #d8dce2", borderRadius: 9, padding: "0 11px", fontSize: 15, outline: "none" },
  chip: { border: "1px solid #d8dce2", background: "#fff", color: "#556", borderRadius: 18, padding: "6px 13px", fontSize: 13, cursor: "pointer" },
  chipActive: { background: "#E6F1FB", borderColor: "#185FA5", color: "#0C447C", fontWeight: 600 },
  cancelBtn: { flex: 1, height: 44, border: "1px solid #d8dce2", background: "#fff", borderRadius: 9, fontSize: 14, cursor: "pointer" },
  saveBtn: { flex: 1, height: 44, border: "none", background: "#185FA5", color: "#fff", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
