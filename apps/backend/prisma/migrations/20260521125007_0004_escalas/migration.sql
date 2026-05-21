-- CreateEnum
CREATE TYPE "EscalaStatus" AS ENUM ('rascunho', 'publicada', 'em_validacao', 'aprovada', 'rejeitada');

-- CreateTable
CREATE TABLE "Escala" (
    "id" SERIAL NOT NULL,
    "lotacao_id" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "status" "EscalaStatus" NOT NULL DEFAULT 'rascunho',
    "criado_por_id" INTEGER NOT NULL,
    "publicado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaDia" (
    "id" SERIAL NOT NULL,
    "escala_id" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "EscalaDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaGuarnicao" (
    "id" SERIAL NOT NULL,
    "escala_dia_id" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "viatura_id" TEXT,
    "turno_inicio" TEXT NOT NULL,
    "turno_fim" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "EscalaGuarnicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaga" (
    "id" SERIAL NOT NULL,
    "escala_guarnicao_id" INTEGER NOT NULL,
    "funcao" TEXT NOT NULL,
    "militar_id" INTEGER,
    "turno_inicio" TEXT NOT NULL,
    "turno_fim" TEXT NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "Vaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaVersao" (
    "id" SERIAL NOT NULL,
    "escala_id" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "publicado_por_id" INTEGER NOT NULL,
    "publicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conteudo" JSONB NOT NULL,

    CONSTRAINT "EscalaVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" INTEGER NOT NULL,
    "payload_antes" JSONB,
    "payload_depois" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Escala_criado_por_id_idx" ON "Escala"("criado_por_id");

-- CreateIndex
CREATE UNIQUE INDEX "Escala_lotacao_id_mes_ano_key" ON "Escala"("lotacao_id", "mes", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaDia_escala_id_data_key" ON "EscalaDia"("escala_id", "data");

-- CreateIndex
CREATE INDEX "EscalaGuarnicao_escala_dia_id_idx" ON "EscalaGuarnicao"("escala_dia_id");

-- CreateIndex
CREATE INDEX "Vaga_escala_guarnicao_id_idx" ON "Vaga"("escala_guarnicao_id");

-- CreateIndex
CREATE INDEX "Vaga_militar_id_idx" ON "Vaga"("militar_id");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaVersao_escala_id_versao_key" ON "EscalaVersao"("escala_id", "versao");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidade_id_idx" ON "AuditLog"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_created_at_idx" ON "AuditLog"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_lotacao_id_fkey" FOREIGN KEY ("lotacao_id") REFERENCES "Lotacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaDia" ADD CONSTRAINT "EscalaDia_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaGuarnicao" ADD CONSTRAINT "EscalaGuarnicao_escala_dia_id_fkey" FOREIGN KEY ("escala_dia_id") REFERENCES "EscalaDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_escala_guarnicao_id_fkey" FOREIGN KEY ("escala_guarnicao_id") REFERENCES "EscalaGuarnicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_militar_id_fkey" FOREIGN KEY ("militar_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaVersao" ADD CONSTRAINT "EscalaVersao_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalaVersao" ADD CONSTRAINT "EscalaVersao_publicado_por_id_fkey" FOREIGN KEY ("publicado_por_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
