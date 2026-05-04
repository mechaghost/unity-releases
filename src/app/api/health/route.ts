export async function GET() {
  return Response.json({
    status: "ok",
    checkedAt: new Date().toISOString(),
    databaseConfigured: Boolean(process.env.DATABASE_URL)
  });
}
