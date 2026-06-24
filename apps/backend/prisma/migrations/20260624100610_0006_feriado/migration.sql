-- CreateEnum
CREATE TYPE "FeriadoTipo" AS ENUM ('nacional', 'estadual', 'municipal', 'facultativo');

-- CreateTable
CREATE TABLE "Feriado" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "FeriadoTipo" NOT NULL DEFAULT 'estadual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_data_key" ON "Feriado"("data");
