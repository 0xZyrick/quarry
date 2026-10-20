import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabaseAdmin";
import { unlockedStudioSession } from "@/lib/server/studioAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max 40MB — keep shorts + images light on free tier */
const MAX_BYTES = 40 * 1024 * 1024;

/**
 * POST multipart field "file"
 * → Supabase Storage bucket (public URL for mosaic)
 * Falls back to local public/uploads only if Supabase env is missing (local dev).
 */
export async function POST(req: NextRequest) {
  if (!(await unlockedStudioSession(req))) {
    return NextResponse.json({ error: "Unlock Studio before uploading media." }, { status: 403 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const blob = file as File;
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: "file too large (max 40MB)" }, { status: 400 });
    }
    const type = blob.type || "";
    const isImage = type.startsWith("image/");
    const isVideo = type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "image or video only" }, { status: 400 });
    }

    const ext =
      (blob.name && blob.name.includes(".") && blob.name.split(".").pop()?.slice(0, 8)?.toLowerCase()) ||
      (isImage ? "jpg" : "webm");
    const id = randomUUID();
    const path = `${isImage ? "images" : "videos"}/${id}.${ext}`;
    const buffer = Buffer.from(await blob.arrayBuffer());

    const hasSupabase =
      !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (hasSupabase) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buffer, {
        contentType: type || (isImage ? "image/jpeg" : "video/webm"),
        upsert: false,
      });
      if (error) {
        console.error("storage upload", error);
        return NextResponse.json({ error: error.message || "upload failed" }, { status: 500 });
      }
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      return NextResponse.json({
        url: data.publicUrl,
        contentType: type,
        size: blob.size,
        kind: isImage ? "image" : "video",
        path,
      });
    }

    // Local fallback (dev only — not durable on Vercel)
    const { writeFile, mkdir } = await import("fs/promises");
    const pathMod = await import("path");
    const dir = pathMod.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${id}.${ext}`;
    await writeFile(pathMod.join(dir, filename), buffer);
    return NextResponse.json({
      url: `/uploads/${filename}`,
      contentType: type,
      size: blob.size,
      kind: isImage ? "image" : "video",
      local: true,
    });
  } catch (e: any) {
    console.error("upload", e);
    return NextResponse.json({ error: e?.message || "upload failed" }, { status: 500 });
  }
}
