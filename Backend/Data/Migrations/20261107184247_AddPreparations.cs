using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TeamCompass.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPreparations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Preparations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    GroupId = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RunsPerWeek = table.Column<int>(type: "integer", nullable: false),
                    Rules = table.Column<List<string>>(type: "text[]", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Preparations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Preparations_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PreparationAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PreparationId = table.Column<int>(type: "integer", nullable: false),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    PaceGroup = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreparationAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreparationAssignments_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PreparationAssignments_Preparations_PreparationId",
                        column: x => x.PreparationId,
                        principalTable: "Preparations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PreparationWeeks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PreparationId = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaceASec = table.Column<int>(type: "integer", nullable: false),
                    PaceBSec = table.Column<int>(type: "integer", nullable: false),
                    PaceCSec = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreparationWeeks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreparationWeeks_Preparations_PreparationId",
                        column: x => x.PreparationId,
                        principalTable: "Preparations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PreparationUnits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PreparationWeekId = table.Column<int>(type: "integer", nullable: false),
                    RunNumber = table.Column<int>(type: "integer", nullable: false),
                    DistanceKm = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreparationUnits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreparationUnits_PreparationWeeks_PreparationWeekId",
                        column: x => x.PreparationWeekId,
                        principalTable: "PreparationWeeks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PreparationEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PreparationUnitId = table.Column<int>(type: "integer", nullable: false),
                    PlayerId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    DeclineReason = table.Column<string>(type: "text", nullable: true),
                    TrainerComment = table.Column<string>(type: "text", nullable: true),
                    Confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreparationEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreparationEntries_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PreparationEntries_PreparationUnits_PreparationUnitId",
                        column: x => x.PreparationUnitId,
                        principalTable: "PreparationUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PreparationEntryImages",
                columns: table => new
                {
                    EntryId = table.Column<int>(type: "integer", nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreparationEntryImages", x => x.EntryId);
                    table.ForeignKey(
                        name: "FK_PreparationEntryImages_PreparationEntries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "PreparationEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PreparationAssignments_PlayerId",
                table: "PreparationAssignments",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_PreparationAssignments_PreparationId_PlayerId",
                table: "PreparationAssignments",
                columns: new[] { "PreparationId", "PlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PreparationEntries_PlayerId",
                table: "PreparationEntries",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_PreparationEntries_PreparationUnitId_PlayerId",
                table: "PreparationEntries",
                columns: new[] { "PreparationUnitId", "PlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Preparations_GroupId",
                table: "Preparations",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_PreparationUnits_PreparationWeekId_RunNumber",
                table: "PreparationUnits",
                columns: new[] { "PreparationWeekId", "RunNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PreparationWeeks_PreparationId_Number",
                table: "PreparationWeeks",
                columns: new[] { "PreparationId", "Number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PreparationAssignments");

            migrationBuilder.DropTable(
                name: "PreparationEntryImages");

            migrationBuilder.DropTable(
                name: "PreparationEntries");

            migrationBuilder.DropTable(
                name: "PreparationUnits");

            migrationBuilder.DropTable(
                name: "PreparationWeeks");

            migrationBuilder.DropTable(
                name: "Preparations");
        }
    }
}
