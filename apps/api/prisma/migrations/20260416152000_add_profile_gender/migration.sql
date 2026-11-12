CREATE TYPE "GenderType" AS ENUM ('male', 'female');

ALTER TABLE "UserProfile"
ADD COLUMN "gender" "GenderType";
