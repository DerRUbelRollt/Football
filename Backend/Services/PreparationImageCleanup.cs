using Microsoft.EntityFrameworkCore;
using TeamCompass.Api.Data;

namespace TeamCompass.Api.Services;

// Löscht Lauf-Screenshots, die nie geprüft wurden, spätestens 14 Tage nach Ende ihrer Woche.
// Geprüfte (bestätigte oder abgelehnte) Bilder löscht schon die Prüfung selbst.
public class PreparationImageCleanup : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private static readonly TimeSpan KeepAfterWeekEnd = TimeSpan.FromDays(14);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PreparationImageCleanup> _logger;

    public PreparationImageCleanup(IServiceScopeFactory scopes, ILogger<PreparationImageCleanup> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Z. B. Migration noch nicht angewendet – beim nächsten Durchlauf erneut versuchen.
                _logger.LogWarning(ex, "Aufräumen der Vorbereitungs-Bilder fehlgeschlagen");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cutoff = DateTime.UtcNow - KeepAfterWeekEnd;
        var deleted = await ctx.PreparationEntryImages
            .Where(i => i.Entry!.Unit!.Week!.EndsAt < cutoff)
            .ExecuteDeleteAsync(ct);
        if (deleted > 0) _logger.LogInformation("{Count} alte Vorbereitungs-Bilder gelöscht", deleted);
    }
}
