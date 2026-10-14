// The only skills a capsule can carry. Nobody types a skill: a tag exists on a profile only through a capsule that earned it.
export const SKILLS=["Interior Design","Coding","Architecture","Carpentry","Mural Painting","3D Motion","Branding UI","3D Layout","Motion Systems"] as const;
export type Skill=typeof SKILLS[number];
export const tagOf=(s:string)=>"#"+s.replace(/\s+/g,"");
