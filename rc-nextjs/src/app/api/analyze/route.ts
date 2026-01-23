import { NextResponse } from "next/server";
import yaml from "js-yaml";
import { SpecSchema } from "@/lib/spec/schema";
import { analyzeSpec } from "@/lib/analyze";

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text) return NextResponse.json({ error: "Missing YAML text" }, { status: 400 });

  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch (e: any) {
    return NextResponse.json({ error: "YAML parse error", details: String(e?.message ?? e) }, { status: 400 });
  }

  const res = SpecSchema.safeParse(parsed);
  if (!res.success) {
    return NextResponse.json({ error: "Spec validation error", details: res.error.format() }, { status: 400 });
  }

  const analysis = analyzeSpec(res.data);
  return NextResponse.json({ spec: res.data, ...analysis });
}
