using System.Collections.Concurrent;

namespace TeamCompass.Api.Services;

public static class SessionStore
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    private sealed record Entry(int UserId, string Email, DateTimeOffset ExpiresAt);

    private static readonly ConcurrentDictionary<string, Entry> _store = new();

    public static string CreateSession(int userId, string email)
    {
        var token = Guid.NewGuid().ToString();
        _store[token] = new Entry(userId, email, DateTimeOffset.UtcNow.Add(Lifetime));
        return token;
    }

    public static (int userId, string email)? Validate(string token)
    {
        if (!_store.TryGetValue(token, out var entry)) return null;
        var now = DateTimeOffset.UtcNow;
        if (entry.ExpiresAt <= now)
        {
            _store.TryRemove(token, out _);
            return null;
        }
        // Gleitende Verlängerung: jede gültige Nutzung setzt die Ablaufzeit neu.
        _store[token] = entry with { ExpiresAt = now.Add(Lifetime) };
        return (entry.UserId, entry.Email);
    }

    public static void Remove(string token) => _store.TryRemove(token, out _);
}
