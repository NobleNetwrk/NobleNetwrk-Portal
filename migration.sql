-- Create the new table first
-- (Prisma will have already generated this part in the file)

-- Move existing data from User to AirdropProfile
INSERT INTO "AirdropProfile" ("id", "userId", "totalAllocation", "lastCheckIn", "updatedAt")
SELECT gen_random_uuid(), "id", "totalAllocation", "lastCheckIn", NOW() FROM "User";

-- Now Prisma's generated code will drop the columns from "User"