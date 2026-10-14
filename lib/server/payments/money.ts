// Zero-float rule. Money crosses the API only as a JSON number that is a whole, positive, safe integer count of kobo.
// Strings, decimals, NaN, negatives and zero are all refused; there is no rounding or coercion anywhere.
export const MAX_KOBO=2_000_000_000;          // keeps one amount safely under the Postgres INT ceiling (2,147,483,647)
export const MAX_BALANCE=2_147_483_647;       // Wallet.internalCreditBalance is a 32-bit INT
export function koboOf(v:unknown):number|null{
  return typeof v==="number"&&Number.isSafeInteger(v)&&v>0&&v<=MAX_KOBO?v:null}
// A contract's whole-Naira figure -> kobo. Null if it is not a whole positive Naira amount.
export function nairaToKobo(naira:unknown):number|null{
  return typeof naira==="number"&&Number.isSafeInteger(naira)&&naira>0?koboOf(naira*100):null}
