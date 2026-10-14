namespace TeamCompass.Api.Models;

public class Attendance
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public Event? Event { get; set; }
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    public string Status { get; set; } = "pending"; // accepted|declined|pending
    // Gäste, die der Spieler zu einem "event" mitbringt (nur bei Zusage befüllt).
    public List<string> Guests { get; set; } = new();
    // Nur bei Events mit Essen: vegan | vegetarian | meat – für den Spieler selbst
    // und parallel zu Guests für jeden Gast (GuestMeals[i] gehört zu Guests[i]).
    public string? Meal { get; set; }
    public List<string> GuestMeals { get; set; } = new();
    public int? TrainerId { get; set; }
    public Trainer? Trainer { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public static readonly string[] Meals = { "vegan", "vegetarian", "meat" };

    public List<GuestView> GuestEntries() =>
        Guests.Select((name, i) => new GuestView(name, i < GuestMeals.Count ? GuestMeals[i] : null)).ToList();

    // Leert alles, was nur zu einer Zusage gehört.
    public void ClearAcceptance()
    {
        Meal = null;
        Guests = new();
        GuestMeals = new();
    }
}

public record GuestView(string Name, string? Meal);
