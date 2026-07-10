namespace TeamCompass.Api.Models;

public class Player
{
    public int Id { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string PlayerCode { get; set; } = null!;
    public int GroupId { get; set; }
    public Group? Group { get; set; }
}
