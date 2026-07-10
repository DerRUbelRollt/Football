namespace TeamCompass.Api.Models;

public class Attendance
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public Event? Event { get; set; }
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    public string Status { get; set; } = "pending"; // accepted|declined|pending
    public int? TrainerId { get; set; }
    public Trainer? Trainer { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
