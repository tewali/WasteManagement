import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { registroCsv, registroEntries } from "@/lib/movements";
import { store } from "@/lib/store";

// Registro cronologico export (CSV). Optional ?year=YYYY filter.
export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const year = new URL(req.url).searchParams.get("year");
  let entries = registroEntries(store.movements());
  if (year) entries = entries.filter((e) => e.year === Number(year));
  const csv = registroCsv(entries);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registro-cronologico${year ? `-${year}` : ""}.csv"`,
    },
  });
}
