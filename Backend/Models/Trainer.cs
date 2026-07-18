using System.ComponentModel.DataAnnotations;

namespace TeamCompass.Api.Models;

public class Trainer
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string Name { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;
}
