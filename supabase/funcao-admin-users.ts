// =====================================================================
// Central de Conteúdo · função "admin-users" (Supabase Edge Function)
// Só a administradora consegue usar. Faz o que o navegador não pode fazer
// com segurança: criar login com senha provisória, resetar senha,
// bloquear/desbloquear, trocar a empresa e excluir acesso.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// senha provisória de 12 caracteres com maiúscula, minúscula, número e caractere especial
// (sem caracteres que confundem, como 0/O e 1/l/I)
function genPassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 12) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

const BAN_FOREVER = "876000h"; // ~100 anos

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // quem está chamando precisa ser administradora
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !user) return json({ error: "Sessão inválida. Entre de novo." }, 401);
    const { data: me } = await admin.from("profiles").select("role, blocked").eq("id", user.id).maybeSingle();
    if (!me || me.role !== "admin" || me.blocked) return json({ error: "Apenas a administradora pode fazer isso." }, 403);

    const body = await req.json().catch(() => ({}));

    const clientExists = async (cid: string) => {
      const { data } = await admin.from("docs").select("id").eq("col", "clients").eq("id", cid).maybeSingle();
      return !!data;
    };
    const getClientProfile = async (id: string) => {
      const { data } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
      return data && data.role === "client" ? data : null;
    };

    switch (body.action) {
      case "create": {
        const email = String(body.email || "").trim().toLowerCase();
        const name = String(body.name || "").trim();
        const clientId = String(body.clientId || "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
        if (!(await clientExists(clientId))) return json({ error: "Empresa não encontrada." }, 400);
        const password = genPassword();
        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { name },
        });
        if (error || !data.user) {
          const dup = /already|registered|exists/i.test(error?.message || "");
          return json({ error: dup ? "Este e-mail já tem um acesso." : "Não foi possível criar o acesso." }, dup ? 409 : 500);
        }
        const { error: perr } = await admin.from("profiles").insert({
          id: data.user.id, email, name, role: "client", client_id: clientId, must_change_password: true,
        });
        if (perr) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: "Não foi possível criar o acesso." }, 500); }
        return json({ id: data.user.id, password });
      }

      case "reset": {
        const p = await getClientProfile(String(body.userId || ""));
        if (!p) return json({ error: "Acesso não encontrado." }, 404);
        const password = genPassword();
        const { error } = await admin.auth.admin.updateUserById(p.id, { password });
        if (error) return json({ error: "Não foi possível resetar a senha." }, 500);
        await admin.from("profiles").update({ must_change_password: true }).eq("id", p.id);
        return json({ password });
      }

      case "block": {
        const ids: string[] = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
        const blocked = !!body.blocked;
        for (const id of ids) {
          const p = await getClientProfile(id);
          if (!p) continue;
          await admin.auth.admin.updateUserById(id, { ban_duration: blocked ? BAN_FOREVER : "none" });
          await admin.from("profiles").update({ blocked }).eq("id", id);
        }
        return json({ ok: true });
      }

      case "update": {
        const p = await getClientProfile(String(body.userId || ""));
        if (!p) return json({ error: "Acesso não encontrado." }, 404);
        const patch: Record<string, unknown> = {};
        if (body.clientId !== undefined) {
          if (!(await clientExists(String(body.clientId)))) return json({ error: "Empresa não encontrada." }, 400);
          patch.client_id = String(body.clientId);
        }
        if (body.name !== undefined) patch.name = String(body.name).trim();
        await admin.from("profiles").update(patch).eq("id", p.id);
        return json({ ok: true });
      }

      case "remove": {
        const p = await getClientProfile(String(body.userId || ""));
        if (!p) return json({ error: "Acesso não encontrado." }, 404);
        const { error } = await admin.auth.admin.deleteUser(p.id);
        if (error) return json({ error: "Não foi possível excluir o acesso." }, 500);
        return json({ ok: true });
      }

      default:
        return json({ error: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    return json({ error: "Erro no servidor: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
