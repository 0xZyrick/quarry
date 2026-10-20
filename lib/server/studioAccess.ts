import type { Session } from "./session";
import { readSession } from "./session";
import { prisma } from "./db";

export async function unlockedStudioSession(req: Request): Promise<Session | null> {
  const session = readSession(req);
  if (!session || session.track !== "creator") return null;
  const account = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { studioUnlocked: true },
  });
  return account?.studioUnlocked ? session : null;
}
