-- Padrão de rodízio do layout (ex.: 24x72 = 4). NULL = diário/sem ciclo.
ALTER TABLE "TemplateGuarnicao" ADD COLUMN "ciclo_dias" INTEGER;
