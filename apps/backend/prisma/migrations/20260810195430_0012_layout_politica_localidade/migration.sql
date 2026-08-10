-- CreateEnum
CREATE TYPE "PoliticaLocalidade" AS ENUM ('indiferente', 'rodizia', 'fixa');

-- AlterTable
ALTER TABLE "TemplateLotacao" ADD COLUMN     "politica_localidade" "PoliticaLocalidade" NOT NULL DEFAULT 'indiferente';
