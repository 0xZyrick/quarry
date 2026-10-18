import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { cleanName } from "@/lib/server/invite";


// Mirror registry reserved + in-memory without claiming
const RESERVED = new Set([
  "mod", "arbiter", "admin", "guild", "quarry", "support", "system", "guest", "me", "wippo",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("handle") || "";
  const excludeUid = searchParams.get("excludeUid");
  const handle = cleanName(raw);

  if (!handle) {
    return NextResponse.json({
      available: false,
      handle: null,
      reason: "Use 2–24 letters or numbers",
    });
  }

  if (RESERVED.has(handle)) {
    return NextResponse.json({
      available: false,
      handle,
      reason: "That name is reserved",
    });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { handle },
      select: { id: true },
    });
    if (existing && existing.id !== excludeUid) {
      return NextResponse.json({
        available: false,
        handle,
        reason: "That name is taken",
      });
    }
  } catch {
    // DB may be down — still allow format-valid handles for local
  }

  return NextResponse.json({ available: true, handle });
}
