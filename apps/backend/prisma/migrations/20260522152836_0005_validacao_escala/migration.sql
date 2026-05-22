-- CreateEnum
CREATE TYPE "ValidacaoStatus" AS ENUM ('aprovada', 'rejeitada');

-- CreateTable
CREATE TABLE "ValidacaoEscala" (
    "id" SERIAL NOT NULL,
    "escala_id" INTEGER NOT NULL,
    "escala_versao_id" INTEGER NOT NULL,
    "gestor_id" INTEGER NOT NULL,
    "status" "ValidacaoStatus" NOT NULL,
    "justificativa" TEXT,
    "mapa_forca_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidacaoEscala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidacaoEscala_escala_id_idx" ON "ValidacaoEscala"("escala_id");

-- CreateIndex
CREATE INDEX "ValidacaoEscala_gestor_id_idx" ON "ValidacaoEscala"("gestor_id");

-- AddForeignKey
ALTER TABLE "ValidacaoEscala" ADD CONSTRAINT "ValidacaoEscala_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidacaoEscala" ADD CONSTRAINT "ValidacaoEscala_escala_versao_id_fkey" FOREIGN KEY ("escala_versao_id") REFERENCES "EscalaVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidacaoEscala" ADD CONSTRAINT "ValidacaoEscala_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
