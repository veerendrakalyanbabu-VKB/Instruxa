/** Cloudflare Worker entry point with D1-backed accounts and prompt projects. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
}
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
type User = { id: string; name: string; email: string };

const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const id = () => crypto.randomUUID();
const bytesToHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((v) => Number.parseInt(v, 16)) ?? []);
const digest = async (value: string) => bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();

async function passwordHash(password: string, salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(salt), iterations: 100_000 }, key, 256);
  return `${salt}:${bytesToHex(new Uint8Array(bits))}`;
}
async function passwordMatches(password: string, stored: string) {
  const [salt] = stored.split(":");
  return stored === await passwordHash(password, salt);
}
function cookie(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("JSON_REQUIRED");
  return await request.json() as Record<string, unknown>;
}
async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = cookie(request, "instruxa_session");
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).bind(await digest(token)).first<User>();
  return row ?? null;
}
async function createSession(userId: string, env: Env) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare(`INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+30 days'))`).bind(id(), userId, await digest(token)).run();
  return { token, header: `instruxa_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` };
}
const projectFields = (value: Record<string, unknown>) => ({
  title: String(value.title ?? "Untitled project").trim().slice(0, 120) || "Untitled project",
  goal: String(value.goal ?? "").trim().slice(0, 10_000),
  audience: String(value.audience ?? "").trim().slice(0, 500),
  tone: String(value.tone ?? "").trim().slice(0, 120),
  model: String(value.model ?? "Universal").trim().slice(0, 80),
  compiled_prompt: String(value.compiledPrompt ?? "").slice(0, 30_000),
});

async function api(request: Request, env: Env) {
  const url = new URL(request.url);
  const method = request.method;
  try {
    if (url.pathname === "/api/health") return json({ ok: true, service: "instruxa", database: "d1" });
    if (url.pathname === "/api/auth/register" && method === "POST") {
      const input = await body(request); const email = normalizeEmail(input.email); const name = String(input.name ?? "").trim().slice(0, 80); const password = String(input.password ?? "");
      if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return json({ error: "Use a valid name, email, and password of at least 10 characters." }, 400);
      const userId = id();
      try {
        const hash = await passwordHash(password);
        await env.DB.prepare("INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)").bind(userId, name, email, hash).run();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error("Instruxa registration failure", detail);
        if (detail.toLowerCase().includes("unique")) return json({ error: "An account with this email already exists." }, 409);
        return json({ error: "Account creation failed securely. Please try again." }, 500);
      }
      const session = await createSession(userId, env);
      return json({ user: { id: userId, name, email } }, 201, { "set-cookie": session.header });
    }
    if (url.pathname === "/api/auth/login" && method === "POST") {
      const input = await body(request); const email = normalizeEmail(input.email); const password = String(input.password ?? "");
      const row = await env.DB.prepare("SELECT id,name,email,password_hash FROM users WHERE email=?").bind(email).first<User & { password_hash: string }>();
      if (!row || !await passwordMatches(password, row.password_hash)) return json({ error: "Invalid email or password." }, 401);
      const session = await createSession(row.id, env);
      return json({ user: { id: row.id, name: row.name, email: row.email } }, 200, { "set-cookie": session.header });
    }
    if (url.pathname === "/api/auth/logout" && method === "POST") {
      const token = cookie(request, "instruxa_session"); if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
      return json({ ok: true }, 200, { "set-cookie": "instruxa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
    }
    if (url.pathname === "/api/auth/session" && method === "GET") return json({ user: await currentUser(request, env) });
    const user = await currentUser(request, env); if (!user) return json({ error: "Authentication required." }, 401);
    if (url.pathname === "/api/projects" && method === "GET") {
      const result = await env.DB.prepare("SELECT id,title,goal,audience,tone,model,compiled_prompt AS compiledPrompt,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(user.id).all();
      return json({ projects: result.results });
    }
    if (url.pathname === "/api/projects" && method === "POST") {
      const data = projectFields(await body(request)); if (!data.goal) return json({ error: "A project goal is required." }, 400); const projectId = id();
      await env.DB.prepare("INSERT INTO projects (id,user_id,title,goal,audience,tone,model,compiled_prompt) VALUES (?,?,?,?,?,?,?,?)").bind(projectId,user.id,data.title,data.goal,data.audience,data.tone,data.model,data.compiled_prompt).run();
      await env.DB.prepare("INSERT INTO project_versions (id,project_id,user_id,version_number,payload) VALUES (?,?,?,?,?)").bind(id(),projectId,user.id,1,JSON.stringify(data)).run();
      return json({ project: { id: projectId, ...data } }, 201);
    }
    const match = url.pathname.match(/^\/api\/projects\/([0-9a-f-]+)(?:\/versions)?$/i);
    if (match) {
      const projectId = match[1];
      if (url.pathname.endsWith("/versions") && method === "GET") {
        const result = await env.DB.prepare("SELECT id,version_number AS versionNumber,payload,created_at AS createdAt FROM project_versions WHERE project_id=? AND user_id=? ORDER BY version_number DESC").bind(projectId,user.id).all();
        return json({ versions: result.results });
      }
      if (method === "PUT") {
        const data = projectFields(await body(request)); const owned = await env.DB.prepare("SELECT id FROM projects WHERE id=? AND user_id=?").bind(projectId,user.id).first(); if (!owned) return json({ error: "Project not found." }, 404);
        await env.DB.prepare("UPDATE projects SET title=?,goal=?,audience=?,tone=?,model=?,compiled_prompt=?,updated_at=datetime('now') WHERE id=? AND user_id=?").bind(data.title,data.goal,data.audience,data.tone,data.model,data.compiled_prompt,projectId,user.id).run();
        const version = await env.DB.prepare("SELECT COALESCE(MAX(version_number),0)+1 AS next FROM project_versions WHERE project_id=?").bind(projectId).first<{next:number}>();
        await env.DB.prepare("INSERT INTO project_versions (id,project_id,user_id,version_number,payload) VALUES (?,?,?,?,?)").bind(id(),projectId,user.id,version?.next??1,JSON.stringify(data)).run(); return json({ project: { id: projectId, ...data } });
      }
      if (method === "DELETE") { const result = await env.DB.prepare("DELETE FROM projects WHERE id=? AND user_id=?").bind(projectId,user.id).run(); return result.meta.changes ? json({ ok: true }) : json({ error: "Project not found." }, 404); }
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("no such table")) return json({ error: "Database setup is incomplete. Apply migrations/0001_accounts_projects.sql." }, 503);
    if (message === "JSON_REQUIRED") return json({ error: "Content-Type application/json is required." }, 415);
    console.error("Instruxa API error", error); return json({ error: "Request could not be completed." }, 500);
  }
}

const worker = { async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return api(request, env);
  if (url.pathname === "/_vinext/image") { const allowedWidths=[...DEFAULT_DEVICE_SIZES,...DEFAULT_IMAGE_SIZES]; return handleImageOptimization(request,{fetchAsset:(path)=>env.ASSETS.fetch(new Request(new URL(path,request.url))),transformImage:async(body,{width,format,quality})=>(await env.IMAGES.input(body).transform(width>0?{width}:{}).output({format,quality})).response()},allowedWidths); }
  return handler.fetch(request, env, ctx);
} };
export default worker;
