-- Employees and articles: "phone" -> "mobNo", "emergencyContactPhone" -> "emergencyMobNo" (data kept).
ALTER TABLE "employees" RENAME COLUMN "phone" TO "mobNo";
ALTER TABLE "employees" RENAME COLUMN "emergencyContactPhone" TO "emergencyMobNo";
ALTER TABLE "articles" RENAME COLUMN "phone" TO "mobNo";
ALTER TABLE "articles" RENAME COLUMN "emergencyContactPhone" TO "emergencyMobNo";
