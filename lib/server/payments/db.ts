import {PrismaClient,Prisma} from "@prisma/client";
const g=globalThis as any;
export const prisma:PrismaClient=g.__quarryPrisma??=new PrismaClient();
export const isUnique=(e:unknown)=>e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002";
export {Prisma};
