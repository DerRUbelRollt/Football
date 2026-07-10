namespace TeamCompass.Api.Services;

public static class TrainerAuth
{
    public static (int userId, string email)? FromRequest(HttpRequest request)
    {
        string? header = request.Headers.Authorization.FirstOrDefault();
        if (header == null || !header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        var token = header[7..].Trim();
        if (token.Length == 0) return null;
        return SessionStore.Validate(token);
    }
}
