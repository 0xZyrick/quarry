// Payment rails are OFF until this is "1". The UI still shows tips, wallet, release and dispute, but they cannot be used,
// and the server refuses every money operation (see app/api/escrow/[room]/route.ts). NEXT_PUBLIC_ so server and browser agree.
export const PAYMENTS_ON=process.env.NEXT_PUBLIC_PAYMENTS_ENABLED==="1";
export const SOON="Payments go live soon";

// Alpha play tokens: while real payments are off, spectators can still drag $2 / $5 / $10 tokens onto a creator's tile and leave a sticky note.
// Nothing is charged or credited; the server records only the note. On by default for the alpha, set NEXT_PUBLIC_ALPHA_TOKENS=0 to switch off.
export const ALPHA_TOKENS=process.env.NEXT_PUBLIC_ALPHA_TOKENS!=="0";
export const TOKENS_ON=PAYMENTS_ON||ALPHA_TOKENS;
