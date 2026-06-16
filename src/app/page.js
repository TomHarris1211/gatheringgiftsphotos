"use client";

import { useEffect, useRef, useState } from "react";
import { TAGS } from "@/lib/tags";

const ACCEPT = {
  photo: "image/jpeg,image/png,image/webp,image/heic,image/heif",
  video: "video/mp4,video/quicktime,video/webm",
};

export default function StaffUploadPage() {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [clients, setClients] = useState([]);
  const [mediaType, setMediaType] = useState("photo");
  const [items, setItems] = useState([]); // { id, file, url, status }
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const fileInput = useRef(null);

  // Restore staff name + client from previous session for convenience.
  useEffect(() => {
    try {
      setName(localStorage.getItem("gg_name") || "");
      setClient(localStorage.getItem("gg_client") || "");
    } catch {}
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => {});
  }, []);

  function pickFiles(e) {
    const files = Array.from(e.target.files || []);
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        status: "ready",
      })),
    ]);
    e.target.value = "";
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleTag(t) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function uploadAll() {
    if (!name.trim()) return alert("Please enter your name.");
    if (!client.trim()) return alert("Please enter the company / client name.");
    if (!items.length) return alert("Add at least one photo or video.");

    try { localStorage.setItem("gg_name", name.trim()); localStorage.setItem("gg_client", client.trim()); } catch {}

    setBusy(true);
    setDone(0);
    const clientCode = client.trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();

    for (const item of items) {
      try {
        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i)));

        const signRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: item.file.type,
            mediaType,
            clientCode,
          }),
        });
        const sign = await signRes.json();
        if (!signRes.ok) throw new Error(sign.error || "Could not get upload URL");

        const put = await fetch(sign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": item.file.type },
          body: item.file,
        });
        if (!put.ok) throw new Error("Upload to storage failed");

        const recRes = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.trim(),
            uploaderName: name.trim(),
            mediaType,
            r2Key: sign.key,
            publicUrl: sign.publicUrl,
            contentType: item.file.type,
            sizeBytes: item.file.size,
            tags,
          }),
        });
        if (!recRes.ok) {
          const e = await recRes.json();
          throw new Error(e.error || "Could not save record");
        }

        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "done" } : i)));
        setDone((d) => d + 1);
      } catch (err) {
        setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status: "error", error: err.message } : i)));
      }
    }
    setBusy(false);
  }

  const allDone = items.length > 0 && items.every((i) => i.status === "done");

  return (
    <main style={S.shell}>
      <header style={S.header}>
        <span style={S.logoDot}>📷</span>
        <span style={S.brand}>Gathering Gifts</span>
      </header>

      <div style={S.body}>
        {allDone ? (
          <div style={S.successCard}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h2 style={{ margin: "8px 0 4px", fontSize: 18 }}>{done} item{done === 1 ? "" : "s"} uploaded</h2>
            <p style={{ color: "#667", margin: 0, fontSize: 14 }}>Thanks, {name.split(" ")[0]}!</p>
            <button style={S.primary} onClick={() => { setItems([]); setTags([]); setDone(0); }}>
              Upload more
            </button>
          </div>
        ) : (
          <>
            <label style={S.label}>Your name</label>
            <input
              style={S.input}
              placeholder="e.g. Tom H"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label style={S.label}>Company / Client name</label>
            <input
              style={S.input}
              placeholder="e.g. AMH"
              list="client-list"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
            <datalist id="client-list">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>

            <div style={S.toggle}>
              {["photo", "video"].map((t) => (
                <button
                  key={t}
                  onClick={() => { setMediaType(t); setItems([]); }}
                  style={{ ...S.toggleBtn, ...(mediaType === t ? S.toggleBtnActive : {}) }}
                >
                  {t === "photo" ? "🖼 Photo" : "🎬 Video"}
                </button>
              ))}
            </div>

            <button style={S.dropzone} onClick={() => fileInput.current?.click()}>
              <div style={{ fontSize: 28 }}>⬆️</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Tap to add {mediaType === "photo" ? "photos" : "video"}</div>
              <div style={{ fontSize: 12, color: "#889" }}>Camera or library</div>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT[mediaType]}
              capture="environment"
              multiple={mediaType === "photo"}
              onChange={pickFiles}
              style={{ display: "none" }}
            />

            {items.length > 0 && (
              <div style={S.grid}>
                {items.map((i) => (
                  <div key={i.id} style={S.thumb}>
                    {i.file.type.startsWith("video") ? (
                      <video src={i.url} style={S.thumbMedia} muted />
                    ) : (
                      <img src={i.url} alt="" style={S.thumbMedia} />
                    )}
                    <span style={S.thumbBadge}>{badge(i.status)}</span>
                    {i.status === "ready" && (
                      <button style={S.thumbX} onClick={() => removeItem(i.id)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label style={S.label}>Tags <span style={{ color: "#99a", fontWeight: 400 }}>· tap to add</span></label>
            <div style={S.chips}>
              {TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  style={{ ...S.chip, ...(tags.includes(t) ? S.chipActive : {}) }}
                >
                  {t}
                </button>
              ))}
            </div>

            <button style={{ ...S.primary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={uploadAll}>
              {busy ? `Uploading ${done}/${items.length}…` : `Upload ${items.length || ""} item${items.length === 1 ? "" : "s"}`.trim()}
            </button>

            <a href="/admin" style={S.adminLink}>Admin sign in →</a>
          </>
        )}
      </div>
    </main>
  );
}

function badge(status) {
  if (status === "done") return "✓";
  if (status === "uploading") return "…";
  if (status === "error") return "!";
  return "";
}

const S = {
  shell: { maxWidth: 460, margin: "0 auto", minHeight: "100dvh", background: "#fff" },
  header: { display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid #eee", position: "sticky", top: 0, background: "#fff", zIndex: 5 },
  logoDot: { fontSize: 18 },
  brand: { fontWeight: 600, fontSize: 15 },
  body: { padding: 16 },
  label: { display: "block", fontSize: 13, color: "#556", margin: "14px 0 6px", fontWeight: 500 },
  input: { width: "100%", height: 46, border: "1px solid #d8dce2", borderRadius: 10, padding: "0 12px", fontSize: 16, outline: "none" },
  toggle: { display: "flex", gap: 6, background: "#f0f2f5", padding: 4, borderRadius: 10, margin: "16px 0 12px" },
  toggleBtn: { flex: 1, height: 38, border: "none", background: "transparent", borderRadius: 7, fontSize: 14, color: "#667", cursor: "pointer" },
  toggleBtnActive: { background: "#fff", color: "#0C447C", fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" },
  dropzone: { width: "100%", border: "2px dashed #c9d0d8", borderRadius: 12, padding: "22px 12px", background: "#fafbfc", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, alignItems: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 },
  thumb: { position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#eef" },
  thumbMedia: { width: "100%", height: "100%", objectFit: "cover" },
  thumbBadge: { position: "absolute", top: 4, left: 4, background: "rgba(255,255,255,0.9)", borderRadius: 12, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0C447C", fontWeight: 700 },
  thumbX: { position: "absolute", top: 4, right: 4, width: 20, height: 20, border: "none", borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, cursor: "pointer" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { border: "1px solid #d8dce2", background: "#fff", color: "#556", borderRadius: 18, padding: "7px 14px", fontSize: 13, cursor: "pointer" },
  chipActive: { background: "#E6F1FB", borderColor: "#185FA5", color: "#0C447C", fontWeight: 600 },
  primary: { width: "100%", height: 50, border: "none", borderRadius: 10, background: "#185FA5", color: "#fff", fontSize: 16, fontWeight: 600, marginTop: 20, cursor: "pointer" },
  adminLink: { display: "block", textAlign: "center", marginTop: 18, color: "#889", fontSize: 13, textDecoration: "none" },
  successCard: { textAlign: "center", padding: "48px 16px" },
};
