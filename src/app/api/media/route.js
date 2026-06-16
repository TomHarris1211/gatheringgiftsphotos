import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { r2, R2_BUCKET } from "@/lib/r2";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------
// POST /api/media  (public — called by the staff upload page)
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

    // Insert the media row (created_at is set automatically by the DB).
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

    // Link tags. Any tag that doesn't exist yet (e.g. a custom "others"
    // value) is created on the fly so it stays filterable/searchable.
    const names = [...new Set((tags || []).map((t) => String(t).trim()).filter(Boolean))];
    if (names.length) {
      const { data: existingTags } = await db
        .from("tags")
        .select("id, name")
        .in("name", names);
      const have = new Set((existingTags || []).map((t) => t.name));
      const toCreate = names.filter((n) => !have.has(n));
      let created = [];
      if (toCreate.length) {
        const { data: c } = await db
          .from("tags")
          .insert(toCreate.map((name) => ({ name })))
          .select("id, name");
        created = c || [];
      }
      const all = [...(existingTags || []), ...created];
      if (all.length) {
        await db
          .from("media_tags")
          .insert(all.map((t) => ({ media_id: media.id, tag_id: t.id })));
      }
    }

    return NextResponse.json({ ok: true, id: media.id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------
// GET /api/media  (admin only — session required)
// Filters: ?client=&uploader=&tag=&from=&to=
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

// ---------------------------------------------------------------------
// DELETE /api/media?id=...  (admin only)
// Removes the object from R2 and the row from the database.
// ---------------------------------------------------------------------
export async function DELETE(req) {
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: row } = await db.from("media").select("r2_key").eq("id", id).maybeSingle();

  if (row?.r2_key) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.r2_key }));
    } catch {
      // ignore storage errors so the DB row can still be removed
    }
  }

  const { error } = await db.from("media").delete().eq("id", id); // cascades to media_tags
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
