namespace TeamCompass.Api.Models;

public class Event
{
    public int Id { get; set; }
    public string EventType { get; set; } = null!; // training | game | event
    public string Title { get; set; } = null!;
    public string? Opponent { get; set; }
    public string? HomeAway { get; set; }
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public string? Location { get; set; }
    public string? MeetingPoint { get; set; }
    public DateTime EventAt { get; set; }
    public string? Description { get; set; }
    // Nur bei "event": wie viele Gäste jeder Spieler mitbringen darf.
    public int MaxGuests { get; set; }
    // Nur bei "event": Spieler wählen bei der Zusage ihr Essen (und das ihrer Gäste).
    public bool WithFood { get; set; }
    public int GroupId { get; set; }
    public Group? Group { get; set; }
}
