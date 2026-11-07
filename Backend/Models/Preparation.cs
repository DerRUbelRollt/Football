namespace TeamCompass.Api.Models;

// Fitness-Vorbereitung einer Mannschaft (z. B. "Winter2026"): ein Laufplan über mehrere Wochen.
// Jede Einheit (Woche x, Training y) ist ein eigenes Vorbereitungs-Ereignis. Es erscheint nur im
// Trainer-Tab "Vorbereitung" und im eigenen Abschnitt beim Spieler – nicht bei den Ereignissen,
// in der Statistik oder der Anwesenheitsquote.
public class Preparation
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public int GroupId { get; set; }
    public Group? Group { get; set; }
    // Zeitraum nur als Datum: Woche 1 beginnt am Startdatum, die letzte Woche endet am Enddatum um 23:59.
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int RunsPerWeek { get; set; }
    // Regeln für alle Spieler, als einzelne Stichpunkte.
    public List<string> Rules { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<PreparationWeek> Weeks { get; set; } = new();

    public static readonly string[] PaceGroups = { "A", "B", "C" };
    // Ohne eigene Zuordnung läuft ein Spieler in Gruppe B.
    public const string DefaultPaceGroup = "B";

    public const int MaxWeeks = 12;
    public const int MaxRunsPerWeek = 4;
    public const int MaxRules = 10;
}

// Eine Kalenderwoche des Plans (Mo–So, die erste ab Startdatum, die letzte bis Enddatum) mit der
// vorgegebenen Pace je Gruppe. Beginn und Ende kommen in Ortszeit berechnet vom Frontend.
public class PreparationWeek
{
    public int Id { get; set; }
    public int PreparationId { get; set; }
    public Preparation? Preparation { get; set; }
    public int Number { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    // Pace in Sekunden pro Kilometer.
    public int PaceASec { get; set; }
    public int PaceBSec { get; set; }
    public int PaceCSec { get; set; }
    public List<PreparationUnit> Units { get; set; } = new();

    public int PaceFor(string paceGroup) => paceGroup switch
    {
        "A" => PaceASec,
        "C" => PaceCSec,
        _ => PaceBSec
    };
}

// Ein Vorbereitungs-Ereignis: der x-te Lauf einer Woche mit seiner Distanz.
public class PreparationUnit
{
    public int Id { get; set; }
    public int PreparationWeekId { get; set; }
    public PreparationWeek? Week { get; set; }
    public int RunNumber { get; set; }
    public decimal DistanceKm { get; set; }
}
