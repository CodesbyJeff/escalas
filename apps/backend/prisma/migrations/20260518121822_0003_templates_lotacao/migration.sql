-- CreateTable
CREATE TABLE "TemplateLotacao" (
    "id" SERIAL NOT NULL,
    "lotacao_id" INTEGER NOT NULL,
    "criado_por_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateLotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateGuarnicao" (
    "id" SERIAL NOT NULL,
    "template_lotacao_id" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "turno_padrao_inicio" TEXT NOT NULL,
    "turno_padrao_fim" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "TemplateGuarnicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVagaSugerida" (
    "id" SERIAL NOT NULL,
    "template_guarnicao_id" INTEGER NOT NULL,
    "funcao" TEXT NOT NULL,
    "quantidade_sugerida" INTEGER NOT NULL,

    CONSTRAINT "TemplateVagaSugerida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateLotacao_lotacao_id_key" ON "TemplateLotacao"("lotacao_id");

-- CreateIndex
CREATE INDEX "TemplateLotacao_criado_por_id_idx" ON "TemplateLotacao"("criado_por_id");

-- CreateIndex
CREATE INDEX "TemplateGuarnicao_template_lotacao_id_idx" ON "TemplateGuarnicao"("template_lotacao_id");

-- CreateIndex
CREATE INDEX "TemplateVagaSugerida_template_guarnicao_id_idx" ON "TemplateVagaSugerida"("template_guarnicao_id");

-- AddForeignKey
ALTER TABLE "TemplateLotacao" ADD CONSTRAINT "TemplateLotacao_lotacao_id_fkey" FOREIGN KEY ("lotacao_id") REFERENCES "Lotacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateLotacao" ADD CONSTRAINT "TemplateLotacao_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateGuarnicao" ADD CONSTRAINT "TemplateGuarnicao_template_lotacao_id_fkey" FOREIGN KEY ("template_lotacao_id") REFERENCES "TemplateLotacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVagaSugerida" ADD CONSTRAINT "TemplateVagaSugerida_template_guarnicao_id_fkey" FOREIGN KEY ("template_guarnicao_id") REFERENCES "TemplateGuarnicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
