import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

const parseJsonIfString = (value: any) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeStringArray = (value: any) => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return null;
  const arr = parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
  return arr.length ? arr : null;
};

const normalizePackages = (value: any) => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return null;
  const arr = parsed
    .map((p) => {
      const features = Array.isArray(p?.features) ? p.features : parseJsonIfString(p?.features);
      const normalizedFeatures = Array.isArray(features)
        ? features.map((f) => String(f ?? "").trim()).filter(Boolean)
        : [];

      const price = p?.price === "" || p?.price == null ? null : Number(p.price);
      const kitValue = p?.kit_value === "" || p?.kit_value == null ? null : Number(p.kit_value);

      return {
        name: String(p?.name ?? "").trim(),
        price,
        kit_value: kitValue,
        features: normalizedFeatures,
        popular: Boolean(p?.popular),
      };
    })
    .filter((p) => p.name || p.price != null || p.features.length || p.kit_value != null || p.popular);

  return arr.length ? arr : null;
};

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method Not Allowed" }) };
    }
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Empty body" }) };
    }

    let body: any;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: "Invalid JSON: " + (e instanceof Error ? e.message : String(e)) }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Server not configured" }) };
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const id = body.id ?? null;
    const title = String(body.title || "").trim();
    const slug = String(body.slug || "").trim();
    const courseType = String(body.course_type || "in-person").trim();

    if (!title) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Title is required" }) };
    }
    if (!slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Slug is required" }) };
    }
    if (courseType !== "online" && courseType !== "in-person") {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Course Type is required" }) };
    }

    const depositAmount =
      body.deposit_amount === "" || body.deposit_amount == null ? null : Number(body.deposit_amount);
    const availableDates = normalizeStringArray(body.available_dates);
    const packages = normalizePackages(body.packages);
    const keyDetails = normalizeStringArray(body.key_details);

    if (courseType === "in-person") {
      if (!Number.isFinite(depositAmount) || (depositAmount as number) <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ ok: false, error: "Deposit amount is required for in-person courses" }),
        };
      }
      if (!availableDates || availableDates.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ ok: false, error: "Available dates are required for in-person courses" }),
        };
      }
      if (!packages || packages.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ ok: false, error: "At least one package is required for in-person courses" }),
        };
      }
      for (const pkg of packages) {
        if (!pkg.name) {
          return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Package name is required" }) };
        }
        if (!Number.isFinite(pkg.price)) {
          return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Package price is required" }) };
        }
        if (!Array.isArray(pkg.features) || pkg.features.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ ok: false, error: "Package features are required" }),
          };
        }
      }
    }

    const payload: any = {
      title,
      slug,
      description: body.description ?? null,
      price: body.price === "" || body.price == null ? null : Number(body.price),
      image_url: body.image_url ?? null,
      duration: body.duration ?? null,
      level: body.level ?? null,
      template_key: body.template_key ?? null,
      course_type: courseType,
      is_active: body.is_active !== false,
      deposit_amount: courseType === "in-person" ? depositAmount : null,
      available_dates: courseType === "in-person" ? availableDates : null,
      packages: courseType === "in-person" ? packages : null,
      key_details: courseType === "in-person" ? keyDetails : null,
    };

    if (id) {
      const { data, error } = await admin
        .from("courses")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, course: data }) };
    }

    const { data, error } = await admin.from("courses").insert([payload]).select("*").single();
    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, course: data }) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err?.message || "Save failed" }) };
  }
};

export const handler = withAdminAuth(baseHandler);
