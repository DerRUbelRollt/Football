namespace TeamCompass.Api.Services;

public static class SessionCookie
{
    public const string Name = "tc_session";

    public static void Append(HttpResponse response, string token) =>
        response.Cookies.Append(Name, token, Options(response.HttpContext.Request, SessionStore.Lifetime));

    public static void Delete(HttpResponse response) =>
        response.Cookies.Delete(Name, Options(response.HttpContext.Request, maxAge: null));

    private static CookieOptions Options(HttpRequest request, TimeSpan? maxAge) => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        Path = "/",
        // Dev läuft über HTTP → Secure=false. Hinter einem HTTPS-Proxy müsste
        // stattdessen X-Forwarded-Proto ausgewertet werden.
        Secure = request.IsHttps,
        MaxAge = maxAge,
    };
}
