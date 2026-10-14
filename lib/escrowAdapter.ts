import {mockEscrow} from "./escrow";
import {httpEscrow} from "./escrowHttp";
// Server API by default. NEXT_PUBLIC_ESCROW=mock keeps the in-browser mock for static demos.
export const escrow=process.env.NEXT_PUBLIC_ESCROW==="mock"?mockEscrow:httpEscrow;
