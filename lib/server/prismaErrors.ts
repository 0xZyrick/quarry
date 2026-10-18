export function isMissingSchemaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["P2021", "P2022"].includes(String((error as { code?: unknown }).code))
  );
}

export const MISSING_COLLABORATION_SCHEMA =
  "Collaboration tables are missing from this database. Apply pending Prisma migrations with `npm run db:migrate` for the database configured by DATABASE_URL.";
