export const dynamic = "force-dynamic";

export async function GET() {
  const sessId = process.env.BOE_SESSID;
  if (!sessId) {
    return Response.json({ active: false, reason: "no_session" });
  }

  try {
    // Try accessing the logged-in search page
    const resp = await fetch("https://subastas.boe.es/reg/subastas_ava.php", {
      headers: {
        Cookie: `SESSID=${sessId}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      redirect: "manual",
    });

    // 200 = logged in, 302 = redirected to login (expired)
    if (resp.status === 200) {
      const html = await resp.text();
      // Double-check: the logged-in page should NOT contain the login redirect
      const isLoggedIn =
        !html.includes("redireccionar") && !html.includes("login");
      return Response.json({ active: isLoggedIn });
    }

    return Response.json({ active: false, reason: "redirect" });
  } catch {
    return Response.json({ active: false, reason: "error" });
  }
}
