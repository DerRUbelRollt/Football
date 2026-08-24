namespace TeamCompass.Api.Models;

public class Event
{
    public int Id { get; set; }
    public string EventType { get; set; } = null!; // training | game
    public string Title { get; set; } = null!;
    public string? Opponent { get; set; }
    public string? HomeAway { get; set; }
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public string? Location { get; set; }
    public string? MeetingPoint { get; set; }
    public DateTime EventAt { get; set; }
    public string? Description { get; set; }
    public int GroupId { get; set; }
    public Group? Group { get; set; }
}
