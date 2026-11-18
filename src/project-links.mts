/** Use the verified website for a project entry; keep source files and section links intact. */
export function projectLink(url: string, websites: Readonly<Record<string, string>>) {
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com" || parsed.hash || parsed.search) return url;
  const repository = parsed.pathname.replace(/^\//, "").replace(/\/$/, "");
  return websites[repository] || url; // A repository remains the destination when no project website or extension listing is verified.
}
