import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getSeed, seedPdfPath } from "@/lib/seed";

// Serves the bundled seed PDFs (demo fixtures R1/R2).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixture: string }> },
) {
  const { fixture } = await params;
  const report = getSeed().reports.find((r) => r.id === fixture);
  if (!report?.pdf) return new NextResponse("Not found", { status: 404 });
  const file = seedPdfPath(report.pdf);
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { "Content-Type": "application/pdf" },
  });
}
