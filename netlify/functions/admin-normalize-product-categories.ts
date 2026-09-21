import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: { ...CORS, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

type Normalized = { category: string; tags?: string[] };

const normalizeCategory = (raw: any): Normalized | null => {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const lower = s.toLowerCase();

  if (lower === "acrylic system - core acrylics" || lower === "acrylic system core acrylics") {
    return { category: "acrylic-system", tags: ["core-acrylics"] };
  }
  if (lower === "acrylic system - coloured acrylics" || lower === "acrylic system coloured acrylics") {
    return { category: "acrylic-system", tags: ["coloured-acrylics"] };
  }

  if (lower === "acrylic system") return { category: "acrylic-system" };
  if (lower === "bundle deals") return { category: "bundle-deals" };
  if (lower === "gel system") return { category: "gel-system" };
  if (lower === "tools & essentials" || lower === "tools and essentials") return { category: "tools-essentials" };
  if (lower === "prep & finish" || lower === "prep & finishing" || lower === "prep and finishing") return { category: "prep-finishing" };
  if (lower === "furniture") return { category: "furniture" };

  if (lower === "acrylic-system" || lower === "bundle-deals" || lower === "gel-system" || lower === "prep-finishing" || lower === "tools-essentials" || lower === "furniture") {
    return { category: lower };
  }

  return null;
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing SUPABASE environment variables" });
  }

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const { data: products, error } = await admin.from("products").select("id,category,tags").limit(5000);
    if (error) return json(500, { ok: false, error: error.message });

    let updated = 0;
    let tagColumnMissing = false;

    for (const p of products || []) {
      const next = normalizeCategory((p as any).category);
      if (!next) continue;

      const patch: any = { category: next.category };

      if (Array.isArray(next.tags) && next.tags.length > 0) {
        const current = Array.isArray((p as any).tags) ? (p as any).tags : [];
        patch.tags = Array.from(new Set([...current, ...next.tags]));
      }

      if ((p as any).category === patch.category && (!patch.tags || JSON.stringify((p as any).tags || []) === JSON.stringify(patch.tags))) {
        continue;
      }

      const { error: updateError } = await admin.from("products").update(patch).eq("id", (p as any).id);
      if (updateError) {
        const msg = String(updateError.message || "");
        const tagsMissing = msg.includes('column \"tags\"') || msg.includes("'tags'") || msg.toLowerCase().includes('schema cache');
        if (tagsMissing) {
          tagColumnMissing = true;
          const retryPatch = { ...patch };
          delete (retryPatch as any).tags;
          const { error: retryError } = await admin.from("products").update(retryPatch).eq("id", (p as any).id);
          if (retryError) return json(500, { ok: false, error: retryError.message });
          updated += 1;
          continue;
        }
        return json(500, { ok: false, error: updateError.message });
      }

      updated += 1;
    }

    return json(200, { ok: true, updated, tagColumnMissing });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || String(err) });
  }
};

export const handler = withAdminAuth(baseHandler);
