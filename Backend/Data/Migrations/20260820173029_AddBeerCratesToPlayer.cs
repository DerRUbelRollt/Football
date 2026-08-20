using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamCompass.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBeerCratesToPlayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BeerCrates",
                table: "Players",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BeerCrates",
                table: "Players");
        }
    }
}
