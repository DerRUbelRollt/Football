using System.Text.RegularExpressions;

namespace TeamCompass.Api.Services;

// Lauf-Screenshots kommen als Data-URL im JSON (vom Browser vorher verkleinert) und gehen genauso
// zurück. Erlaubt sind nur echte JPEG-, PNG- und WebP-Dateien bis 3 MB.
public static partial class PreparationImages
{
    public const int MaxBytes = 3 * 1024 * 1024;

    [GeneratedRegex(@"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$")]
    private static partial Regex DataUrlPattern();

    public static bool TryParse(string? dataUrl, out byte[] data, out string contentType, out string? error)
    {
        data = Array.Empty<byte>();
        contentType = "";
        error = null;
        var match = DataUrlPattern().Match(dataUrl ?? "");
        if (!match.Success)
        {
            error = "Bitte ein Bild (JPG, PNG oder WebP) hochladen";
            return false;
        }
        try
        {
            data = Convert.FromBase64String(match.Groups[2].Value);
        }
        catch (FormatException)
        {
            error = "Das Bild konnte nicht gelesen werden";
            return false;
        }
        if (data.Length == 0)
        {
            error = "Bitte ein Bild (JPG, PNG oder WebP) hochladen";
            return false;
        }
        if (data.Length > MaxBytes)
        {
            error = "Das Bild ist zu groß (max. 3 MB)";
            return false;
        }
        contentType = match.Groups[1].Value;
        if (!HasMatchingSignature(data, contentType))
        {
            error = "Die Datei ist kein gültiges Bild";
            return false;
        }
        return true;
    }

    public static string ToDataUrl(byte[] data, string contentType) =>
        $"data:{contentType};base64,{Convert.ToBase64String(data)}";

    // Prüft die ersten Bytes, damit nur echte Bilddateien gespeichert werden.
    private static bool HasMatchingSignature(byte[] d, string contentType) => contentType switch
    {
        "image/jpeg" => d.Length > 3 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF,
        "image/png" => d.Length > 8 && d[0] == 0x89 && d[1] == 0x50 && d[2] == 0x4E && d[3] == 0x47,
        "image/webp" => d.Length > 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
            && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P',
        _ => false
    };
}
