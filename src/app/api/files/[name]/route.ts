import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const safe = path.basename(decodeURIComponent(name));
  const file = path.join(UPLOAD_DIR, safe);
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  const buf = fs.readFileSync(file);
  const type = safe.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": type, "Content-Disposition": `inline; filename="${safe}"` },
  });
}
