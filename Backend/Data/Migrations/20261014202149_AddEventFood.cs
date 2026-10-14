using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamCompass.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventFood : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "WithFood",
                table: "Events",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "GuestMeals",
                table: "Attendances",
                type: "text[]",
                nullable: false,
                // Bestehende Anwesenheiten bekommen eine leere Liste.
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<string>(
                name: "Meal",
                table: "Attendances",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WithFood",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "GuestMeals",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "Meal",
                table: "Attendances");
        }
    }
}
