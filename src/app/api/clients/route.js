import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/clients  -> list of clients for the staff picker
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("clients")
    .select("id, name, code")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}
