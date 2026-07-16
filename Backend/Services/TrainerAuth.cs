namespace TeamCompass.Api.Services;

public static class TrainerAuth
{
    public static (int userId, string email)? FromRequest(HttpRequest request)
    {
        var token = TokenFromRequest(request);
        return string.IsNullOrEmpty(token) ? null : SessionStore.Validate(token);
    }

    // Session-Cookie hat Vorrang; Authorization: Bearer bleibt als Fallback (Swagger/Tests).
    public static string? TokenFromRequest(HttpRequest request)
    {
        if (request.Cookies.TryGetValue(SessionCookie.Name, out var cookie) && !string.IsNullOrWhiteSpace(cookie))
            return cookie;

        string? header = request.Headers.Authorization.FirstOrDefault();
        if (header != null && header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = header[7..].Trim();
            if (token.Length > 0) return token;
        }
        return null;
    }
}
