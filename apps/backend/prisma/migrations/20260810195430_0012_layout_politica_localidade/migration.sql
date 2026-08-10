-- CreateEnum
CREATE TYPE "PoliticaLocalidade" AS ENUM ('indiferente', 'rodizia', 'fixa');

-- AlterTable
ALTER TABLE "FuncaoPatente" ALTER COLUMN "patente_ids" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TemplateLotacao" ADD COLUMN     "politica_localidade" "PoliticaLocalidade" NOT NULL DEFAULT 'indiferente';
