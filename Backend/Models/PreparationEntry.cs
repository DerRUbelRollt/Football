namespace TeamCompass.Api.Models;

// Gruppe A/B/C eines Spielers in einer Vorbereitung. Sie gilt für alle Ereignisse der Vorbereitung;
// ohne Eintrag ist der Spieler in Gruppe B.
public class PreparationAssignment
{
    public int Id { get; set; }
    public int PreparationId { get; set; }
    public Preparation? Preparation { get; set; }
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    public string PaceGroup { get; set; } = Preparation.DefaultPaceGroup;
}

// Rückmeldung eines Spielers zu einem Vorbereitungs-Ereignis. Wird erst angelegt, wenn der Spieler
// oder der Trainer etwas tut – ohne Eintrag ist der Lauf offen.
public class PreparationEntry
{
    public int Id { get; set; }
    public int PreparationUnitId { get; set; }
    public PreparationUnit? Unit { get; set; }
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    public string Status { get; set; } = PendingStatus; // pending | done | declined
    // Was der Spieler zu seinem Lauf schreibt (optional).
    public string? Description { get; set; }
    // Begründung einer Absage (Pflicht beim Absagen).
    public string? DeclineReason { get; set; }
    // Kommentar des Trainers bei "Nicht bestätigt" – der Spieler sieht ihn als Hinweis.
    public string? TrainerComment { get; set; }
    // Vom Trainer geprüft und bestätigt (nur bei "done").
    public bool Confirmed { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public PreparationEntryImage? Image { get; set; }

    public const string PendingStatus = "pending";
    public const string DoneStatus = "done";
    public const string DeclinedStatus = "declined";
    // Nur abgeleitet: offen geblieben, obwohl die Woche vorbei ist. Zählt als "Nicht erledigt".
    public const string MissedStatus = "missed";

    public static string DisplayStatus(string? status, DateTime weekEndsAt, DateTime now) => status switch
    {
        DoneStatus => DoneStatus,
        DeclinedStatus => DeclinedStatus,
        _ => now >= weekEndsAt ? MissedStatus : PendingStatus
    };
}

// Screenshot als Nachweis eines Laufs. Eigene Tabelle, damit Listen nie Bilddaten laden.
// Wird bei Bestätigung oder Ablehnung sofort gelöscht, ungeprüft spätestens 14 Tage nach Wochenende.
public class PreparationEntryImage
{
    public int EntryId { get; set; }
    public PreparationEntry? Entry { get; set; }
    public byte[] Data { get; set; } = null!;
    public string ContentType { get; set; } = null!;
}
