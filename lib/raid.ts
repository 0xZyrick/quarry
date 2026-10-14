// Mock "Apply to Raid" call. Replace with a real endpoint; the server must check the applicant's role.
export const applyToRaid=async(roomId:string,note:string):Promise<{ok:true}>=>{
  await new Promise(r=>setTimeout(r,600));
  if(!note.trim())throw new Error("empty");
  return{ok:true}};
