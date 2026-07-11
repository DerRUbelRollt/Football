namespace TeamCompass.Api.Models;

public class PlayerGroupMembership
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player? Player { get; set; }
    public int GroupId { get; set; }
    public Group? Group { get; set; }
}
