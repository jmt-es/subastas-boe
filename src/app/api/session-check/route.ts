export async function GET() {
  const sessId = process.env.BOE_SESSID;
  if (!sessId) {
    return Response.json({ active: false, reason: "no session configured" });
  }

  try {
    // Quick check: try to access the logged-in area
    const resp = await fetch("https://subastas.boe.es/reg/subastas_ava.php", {
      headers: {
        Cookie: `SESSID=${sessId}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "manual",
    });

    // If we get redirected to login, session is expired
    const active = resp.status === 200;
    return Response.json({ active });
  } catch {
    return Response.json({ active: false, reason: "check failed" });
  }
}
