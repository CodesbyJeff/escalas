-- CreateEnum
CREATE TYPE "ExecucaoStatus" AS ENUM ('pendente', 'registrada', 'validada', 'rejeitada');

-- CreateEnum
CREATE TYPE "SituacaoExecucao" AS ENUM ('presente', 'falta', 'substituido', 'preenchido');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FISCAL';

-- AlterTable
ALTER TABLE "EscalaDia" ADD COLUMN     "execucao_status" "ExecucaoStatus" NOT NULL DEFAULT 'pendente',
ADD COLUMN     "fiscal_id" INTEGER,
ADD COLUMN     "justificativa" TEXT,
ADD COLUMN     "validado_em" TIMESTAMP(3),
ADD COLUMN     "validado_por_id" INTEGER;

-- CreateTable
CREATE TABLE "ExecucaoVaga" (
    "id" SERIAL NOT NULL,
    "vaga_id" INTEGER NOT NULL,
    "situacao" "SituacaoExecucao" NOT NULL,
    "militar_executado_id" INTEGER,
    "do" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecucaoVaga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecucaoVaga_vaga_id_key" ON "ExecucaoVaga"("vaga_id");

-- AddForeignKey
ALTER TABLE "EscalaDia" ADD CONSTRAINT "EscalaDia_fiscal_id_fkey" FOREIGN KEY ("fiscal_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDia" ADD CONSTRAINT "EscalaDia_validado_por_id_fkey" FOREIGN KEY ("validado_por_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoVaga" ADD CONSTRAINT "ExecucaoVaga_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "Vaga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoVaga" ADD CONSTRAINT "ExecucaoVaga_militar_executado_id_fkey" FOREIGN KEY ("militar_executado_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
