export const dynamic = "force-dynamic";

export async function GET() {
  const sessId = process.env.BOE_SESSID;
  if (!sessId) {
    return Response.json({ active: false, reason: "no_session" });
  }

  try {
    const cookies = [`SESSID=${sessId}`];
    const simpleSaml = process.env.BOE_SIMPLESAML;
    if (simpleSaml) cookies.push(`SimpleSAML=${simpleSaml}`);

    const resp = await fetch("https://subastas.boe.es/reg/subastas_ava.php", {
      headers: {
        Cookie: cookies.join("; "),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      redirect: "manual",
    });

    // 302 = redirected to login (expired)
    if (resp.status !== 200) {
      return Response.json({ active: false, reason: "redirect" });
    }

    const html = await resp.text();

    // If logged in, the page contains the search form with "accion" field
    // If NOT logged in, it shows a "redireccionar" meta refresh or SSO redirect
    const isLoggedIn =
      html.includes('name="accion"') || html.includes("Buscar");

    return Response.json({ active: isLoggedIn });
  } catch {
    return Response.json({ active: false, reason: "error" });
  }
}
