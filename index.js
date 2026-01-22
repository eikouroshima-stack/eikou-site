export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- helpers ----
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });

    const text = (msg, status = 200) =>
      new Response(msg, {
        status,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });

    // CORS (必要なら)
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ---- auth / level ----
    const pw = url.searchParams.get("pw") || "";
    const level =
      pw && pw === (env.PW_ADMIN || "") ? 3 :
      pw && pw === (env.PW_L3 || "") ? 3 :
      pw && pw === (env.PW_L2 || "") ? 2 :
      pw && pw === (env.PW_L1 || "") ? 1 :
      0;

    // ---- routes ----

    // 公開：品番一覧だけ（PW不要）
    if (path === "/api/public") {
      // KVに "items" というキーで JSON配列を入れる想定（まだ空でもOK）
      // 例: [{"sku":"P-200R","minLot":50,"leadTimeWeeks":"2-4"}]
      const raw = (await env.INVENTORY_KV?.get("items")) || "[]";
      let items = [];
      try { items = JSON.parse(raw); } catch { items = []; }

      // 公開は「品番だけ」
      const skus = items.map(x => x.sku).filter(Boolean);
      return json({ skus }, 200);
    }

    // 在庫：PWあり（level>=1で見れる）
    if (path === "/api/inventory") {
      if (level === 0) return json({ error: "Unauthorized" }, 401);

      const raw = (await env.INVENTORY_KV?.get("items")) || "[]";
      let items = [];
      try { items = JSON.parse(raw); } catch { items = []; }

      // level1: 在庫レンジ + LT
      // level2: + 最小ロット
      // level3: + 最終更新日時（必要なら）
      const view = items.map((x) => {
        const base = {
          sku: x.sku || "",
          stockRange: x.stockRange || "0",       // 0 / 1-200 / 201-400 / 401-700 / 700+
          leadTime: x.leadTime || "",           // 例: "2-4 weeks"
        };
        if (level >= 2) base.minLot = x.minLot ?? null;
        if (level >= 3) base.updatedAt = x.updatedAt || null;
        return base;
      });

      return json({ level, items: view }, 200);
    }

    // デフォルト
    return text("OK. Try /api/public or /api/inventory?pw=...", 200);
  },
};
