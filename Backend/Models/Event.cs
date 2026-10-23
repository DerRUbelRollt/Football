namespace TeamCompass.Api.Models;

public class Event
{
    public int Id { get; set; }
    public string EventType { get; set; } = null!; // training | game | event | meeting
    public string Title { get; set; } = null!;
    public string? Opponent { get; set; }
    public string? HomeAway { get; set; }
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public string? Location { get; set; }
    public string? MeetingPoint { get; set; }
    // Bei "meeting": erster Vorschlag, nach der Festlegung durch den Spieler der gewählte Termin.
    public DateTime EventAt { get; set; }
    public string? Description { get; set; }
    // Nur bei "event": wie viele Gäste jeder Spieler mitbringen darf.
    public int MaxGuests { get; set; }
    // Nur bei "event": Spieler wählen bei der Zusage ihr Essen (und das ihrer Gäste).
    public bool WithFood { get; set; }
    // Nur bei "event", optional: bis wann Spieler zu- oder absagen bzw. ändern können.
    public DateTime? DeadlineAt { get; set; }
    // Bei "meeting" (Einzelgespräch) leer – das Gespräch gehört zu keiner Mannschaft.
    public int? GroupId { get; set; }
    public Group? Group { get; set; }
    // Nur bei "meeting": der Spieler, mit dem das Gespräch stattfindet.
    public int? PlayerId { get; set; }
    public Player? Player { get; set; }
    // Nur bei "meeting": 1–3 Terminvorschläge des Trainers, chronologisch sortiert.
    public List<DateTime> ProposedTimes { get; set; } = new();

    public const string MeetingType = "meeting";

    // Ein Einzelgespräch bleibt bis 1 Stunde nach dem gewählten Termin aktuell, ohne Festlegung
    // bis 1 Stunde nach dem letzten Vorschlag – danach steht es in der Historie.
    public DateTime MeetingActiveUntil(bool confirmed) =>
        (confirmed || ProposedTimes.Count == 0 ? EventAt : ProposedTimes.Max()).AddHours(1);

    // Antwort des Spielers (seine Anwesenheit) als Gesprächsstand:
    // offen (orange), festgelegt (grün) oder "Keiner passt" (rot).
    public static string MeetingStatusOf(string? attendanceStatus) => attendanceStatus switch
    {
        "accepted" => "confirmed",
        "declined" => "none_fits",
        _ => "open"
    };

    public static DateTime ToMinute(DateTime utc) =>
        new(utc.Ticks - utc.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);
}
