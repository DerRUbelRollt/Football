using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamCompass.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlayerNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TestSpalte",
                table: "Players",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TestSpalte",
                table: "Players");
        }
    }
}
