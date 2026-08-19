namespace TeamCompass.Api.Models;

public class Player
{
    public int Id { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string PlayerCode { get; set; } = null!;
    public decimal PlayerPenalty { get; set; } = 0.00m;
    public bool PenaltyManager { get; set; } = false;
    public ICollection<PlayerGroupMembership> GroupMemberships { get; set; } = new List<PlayerGroupMembership>();
}
