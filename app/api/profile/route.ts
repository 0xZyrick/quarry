import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { weeksShipped, countShippedWeeks } from "@/lib/activityGrid";
import { readSession, cookieFor } from "@/lib/server/session";


const KIND_LABEL: Record<string, string> = {
  MILESTONE: "Milestone",
  DEAD_END: "Dead end",
  DECISION: "Decision",
  PARTIAL: "Partial",
};

/**
 * GET  ?userId= | ?handle=
 * Returns profile + living resume fields:
 * activityWeeks, thinking moments, skills from project tags, helped others.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const handle = searchParams.get("handle");

  if (!userId && !handle) {
    return NextResponse.json({ error: "userId or handle required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { OR: [{ handle: handle! }, { id: handle! }] },
    select: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      levelTrack: true,
      createdAt: true,
      _count: {
        select: {
          projects: true,
          followers: true,
          following: true,
          projectFollows: true,
        },
      },
      projects: {
        where: { visibility: "PUBLIC" },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: {
          id: true,
          title: true,
          intentStatement: true,
          status: true,
          tags: true,
          updatedAt: true,
          createdAt: true,
          _count: { select: { followers: true, journeyNodes: true } },
          journeyNodes: {
            orderBy: { position: "desc" },
            take: 8,
            select: {
              id: true,
              position: true,
              dayLabel: true,
              phaseTitle: true,
              summaryText: true,
              evolutionDelta: true,
              updateKind: true,
              promptUsed: true,
              tools: true,
              nextSnapshotUrl: true,
              prevSnapshotUrl: true,
              createdAt: true,
              mediaDrops: { take: 1, select: { videoUrl: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Session ships for activity grid (last ~90 days)
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  let shipDays: string[] = [];
  try {
    const ships = await (prisma as any).sessionShip.findMany({
      where: { userId: user.id, createdAt: { gte: since } },
      select: { dayKey: true },
    });
    shipDays = ships.map((s: any) => s.dayKey);
  } catch {
    // table may not exist yet — fall back empty
  }

  // Fallback: use journey node createdAt days as ships if no SessionShip rows
  if (!shipDays.length) {
    for (const p of user.projects) {
      for (const n of p.journeyNodes) {
        shipDays.push(n.createdAt.toISOString().slice(0, 10));
      }
    }
  }

  const activityWeeks = weeksShipped(shipDays, 12);
  const shippedWeekCount = countShippedWeeks(activityWeeks);

  // Thinking moments from updateKind
  const thinking: any[] = [];
  for (const p of user.projects) {
    for (const n of p.journeyNodes) {
      thinking.push({
        id: n.id,
        kind: KIND_LABEL[n.updateKind as string] || "Milestone",
        project: p.title,
        week: n.dayLabel,
        title: n.phaseTitle,
        body: n.summaryText,
        projectId: p.id,
        createdAt: n.createdAt,
      });
    }
  }
  thinking.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  // Skills from project tags + node tools
  const skillSet = new Set<string>();
  for (const p of user.projects) {
    for (const t of p.tags || []) skillSet.add(t);
    for (const n of p.journeyNodes) {
      for (const t of n.tools || []) skillSet.add(t);
    }
  }

  // Helped others — contributions marked helpful by hosts
  let helped: { who: string; what: string; project?: string }[] = [];
  try {
    const helpful = await prisma.contribution.findMany({
      where: { userId: user.id, markedHelpful: true },
      orderBy: { markedHelpfulAt: "desc" },
      take: 12,
      include: {
        journeyNode: {
          select: {
            phaseTitle: true,
            dayLabel: true,
            project: { select: { title: true, creator: { select: { handle: true } } } },
          },
        },
      },
    });
    helped = helpful.map((c) => ({
      who: c.journeyNode.project.creator.handle || "builder",
      what: `${c.messageText.slice(0, 120)}${c.journeyNode.dayLabel ? ` (${c.journeyNode.dayLabel})` : ""}`,
      project: c.journeyNode.project.title,
    }));
  } catch {
    /* ignore */
  }

  const deadEnds = thinking.filter((t) => t.kind === "Dead end").length;
  const decisions = thinking.filter((t) => t.kind === "Decision").length;
  const recordLine = `${thinking.length} stops over the last chapters. ${deadEnds} dead end${
    deadEnds === 1 ? "" : "s"
  } shared openly, ${decisions} decision${decisions === 1 ? "" : "s"} put to the community, and help given to ${helped.length} other builder${
    helped.length === 1 ? "" : "s"
  }.`;

  return NextResponse.json({
    profile: {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName || user.handle,
      bio: user.bio || "",
      avatarUrl: user.avatarUrl,
      levelTrack: user.levelTrack,
      joinedAt: user.createdAt,
      counts: {
        projects: user._count.projects,
        followers: user._count.followers,
        following: user._count.following,
        circles: user._count.projectFollows,
      },
      activityWeeks,
      shippedWeekCount,
      recordLine,
      thinking: thinking.slice(0, 24),
      skills: Array.from(skillSet).slice(0, 16),
      helped,
      projects: user.projects.map((p) => {
        const n = p.journeyNodes[0];
        return {
          id: p.id,
          title: p.title,
          intent: p.intentStatement,
          status: p.status,
          tags: p.tags,
          updatedAt: p.updatedAt,
          followerCount: p._count.followers,
          nodeCount: p._count.journeyNodes,
          cover: n?.nextSnapshotUrl || n?.prevSnapshotUrl || null,
          latest: n?.summaryText || n?.phaseTitle || null,
        };
      }),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = readSession(req);
  if (!session) return NextResponse.json({ error: "Sign in to edit your profile." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId, handle, displayName, bio, avatarUrl } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId !== session.uid) return NextResponse.json({ error: "You can only edit your own profile." }, { status: 403 });
  const data: Record<string, unknown> = {};
  if (typeof handle === "string" && handle.trim()) data.handle = handle.trim().replace(/^@/, "").slice(0, 32);
  if (typeof displayName === "string") data.displayName = displayName.trim().slice(0, 48);
  if (typeof bio === "string") data.bio = bio.trim().slice(0, 280);
  if (typeof avatarUrl === "string" && avatarUrl.length <= 500_000) data.avatarUrl = avatarUrl;
  if (!Object.keys(data).length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  try {
    const user = await prisma.user.update({
      where: { id: session.uid },
      data,
      select: { id: true, handle: true, displayName: true, bio: true, avatarUrl: true, accountTrack: true },
    });
    const headers = new Headers({ "Content-Type": "application/json" });
    if (user.handle) {
      const track = user.accountTrack === "client" ? "client" : user.accountTrack === "creator" ? "creator" : session.track;
      headers.append("Set-Cookie", cookieFor({ uid: user.id, handle: user.handle, track }));
    }
    return new NextResponse(JSON.stringify({ user }), { status: 200, headers });
  } catch (error) {
    console.error("PATCH /api/profile", error);
    return NextResponse.json({ error: "Could not update your profile." }, { status: 500 });
  }
}
