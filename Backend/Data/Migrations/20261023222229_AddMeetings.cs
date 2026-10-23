using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamCompass.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMeetings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "GroupId",
                table: "Events",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "PlayerId",
                table: "Events",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<List<DateTime>>(
                name: "ProposedTimes",
                table: "Events",
                type: "timestamp with time zone[]",
                nullable: false,
                // Bestehende Ereignisse bekommen eine leere Vorschlagsliste.
                defaultValueSql: "'{}'");

            migrationBuilder.CreateIndex(
                name: "IX_Events_PlayerId",
                table: "Events",
                column: "PlayerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Players_PlayerId",
                table: "Events",
                column: "PlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_Players_PlayerId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_PlayerId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "PlayerId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ProposedTimes",
                table: "Events");

            migrationBuilder.AlterColumn<int>(
                name: "GroupId",
                table: "Events",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
