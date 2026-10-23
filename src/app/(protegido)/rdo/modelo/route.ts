import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const arquivo = await readFile(path.join(process.cwd(), "RDO-MODELO.pdf"));
  return new Response(arquivo, { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
