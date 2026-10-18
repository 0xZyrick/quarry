import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, appendFile } from "fs/promises";
import path from "path";

/** Lightweight report queue (file-backed until moderation DB exists). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { targetType, targetId, reason, note } = body;
  if (!targetType || !targetId || !reason) {
    return NextResponse.json({ error: "targetType, targetId, reason required" }, { status: 400 });
  }
  const allowed = ["project", "node", "user", "session"];
  if (!allowed.includes(targetType)) {
    return NextResponse.json({ error: "invalid targetType" }, { status: 400 });
  }
  const row = {
    at: new Date().toISOString(),
    targetType,
    targetId: String(targetId),
    reason: String(reason).slice(0, 80),
    note: note ? String(note).slice(0, 500) : null,
  };
  try {
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "reports.jsonl"), JSON.stringify(row) + "\n", "utf8");
  } catch (e) {
    console.error("report write", e);
  }
  return NextResponse.json({ ok: true });
}
