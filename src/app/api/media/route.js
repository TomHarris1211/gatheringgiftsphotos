import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------
// POST /api/media  (public — called by the staff upload page)
// Records one uploaded item after it has been PUT to R2.
// body: { clientName, uploaderName, mediaType, r2Key, publicUrl,
//         contentType, sizeBytes, tags: string[] }
// ---------------------------------------------------------------------
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      clientName, uploaderName, mediaType,
      r2Key, publicUrl, contentType, sizeBytes, tags = [],
    } = body;

    if (!clientName || !uploaderName || !r2Key || !publicUrl) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Find-or-create the client (case-insensitive on name).
    const name = clientName.trim();
    let clientId;
    const { data: existing } = await db
      .from("clients")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const code = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
      const { data: created, error: cErr } = await db
        .from("clients")
        .insert({ name, code })
        .select("id")
        .single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      clientId = created.id;
    }

    // Insert the media row.
    const { data: media, error: mErr } = await db
      .from("media")
      .insert({
        client_id: clientId,
        uploader_name: uploaderName.trim(),
        media_type: mediaType,
        r2_key: r2Key,
        public_url: publicUrl,
        content_type: contentType || null,
        size_bytes: sizeBytes || null,
      })
      .select("id")
      .single();
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    // Link tags (only those in the fixed taxonomy).
    if (Array.isArray(tags) && tags.length) {
      const { data: tagRows } = await db
        .from("tags")
        .select("id, name")
        .in("name", tags);
      if (tagRows?.length) {
        await db.from("media_tags").insert(
          tagRows.map((t) => ({ media_id: media.id, tag_id: t.id }))
        );
      }
    }

    return NextResponse.json({ ok: true, id: media.id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------
// GET /api/media  (admin only — session required)
// Filters: ?client=&uploader=&tag=&from=&to=&search=
// ---------------------------------------------------------------------
export async function GET(req) {
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const client = searchParams.get("client");
  const uploader = searchParams.get("uploader");
  const tag = searchParams.get("tag");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = supabaseAdmin();
  let q = db.from("media_view").select("*").order("created_at", { ascending: false });

  if (client) q = q.eq("client_id", client);
  if (uploader) q = q.ilike("uploader_name", uploader);
  if (tag) q = q.contains("tags", [tag]);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media: data });
}
