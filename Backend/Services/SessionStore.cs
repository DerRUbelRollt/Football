namespace TeamCompass.Api.Services;

public static class SessionStore
{
    private static readonly Dictionary<string, (int userId, string email)> _store = new();

    public static string CreateSession(int userId, string email)
    {
        var token = Guid.NewGuid().ToString();
        _store[token] = (userId, email);
        return token;
    }

    public static (int userId, string email)? Validate(string token)
    {
        if (_store.TryGetValue(token, out var v)) return v;
        return null;
    }
}
