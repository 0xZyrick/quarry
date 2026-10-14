export const metadata={title:"Community guidelines · Quarry"};
// DRAFT. Have counsel review before launch (terms of service, privacy policy, takedown and law-enforcement process are separate documents).
export default function Guidelines(){
  const h="text-base font-semibold mt-6",p="text-sm text-neutral-300 leading-relaxed";
  return <main className="min-h-screen bg-deep text-neutral-200 p-6 max-w-2xl mx-auto">
    <h1 className="text-xl font-semibold">Community guidelines</h1>
    <p className={p+" mt-2"}>Quarry is a place to watch people do skilled work and to hire them. These rules keep it that way.</p>
    <h2 className={h}>Stream skilled work</h2>
    <p className={p}>A live room has to show real work: a screen, a canvas or a bench. Just chatting, driving, lifestyle and reaction streams are not allowed, and rooms that break this can be hidden.</p>
    <h2 className={h}>Treat people well</h2>
    <p className={p}>No harassment, hate, threats, sexual content or graphic violence. No spam, scams or impersonation. Nothing that endangers a minor, and nothing illegal. These last two are removed immediately while we review.</p>
    <h2 className={h}>How reports work</h2>
    <p className={p}>Anyone signed in can report a room or a person. A report is a signal, not a verdict. When enough trusted reports arrive, a room is held for a moderator, and a person can be muted until review. Accounts that file false reports lose influence.</p>
    <h2 className={h}>Strikes and appeals</h2>
    <p className={p}>A first upheld case hides the room for 24 hours, a second for 7 days, and a third restricts the account for 30 days. Serious violations lead to a permanent ban. You can appeal each case once, and a different moderator reviews it.</p>
    <h2 className={h}>Money and fairness</h2>
    <p className={p}>Milestone payments are released only by the paying client. If you dispute a milestone, release freezes until an arbiter decides.</p>
  </main>;
}
