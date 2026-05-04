async function main() {
  console.log(
    JSON.stringify({
      status: "ok",
      checkedAt: new Date().toISOString(),
      databaseConfigured: Boolean(process.env.DATABASE_URL)
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
