-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ESCALANTE', 'MILITAR', 'GESTOR');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "cpf" TEXT NOT NULL,
    "matricula" TEXT,
    "nome" TEXT NOT NULL,
    "nome_curto" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "posto" TEXT,
    "sisbom_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lotacao" (
    "id" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "lotacao_pai_id" INTEGER,
    "nivel" INTEGER NOT NULL,
    "operacional" BOOLEAN NOT NULL DEFAULT false,
    "externo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLotacao" (
    "user_id" INTEGER NOT NULL,
    "lotacao_id" INTEGER NOT NULL,
    "nivel" INTEGER NOT NULL,

    CONSTRAINT "UserLotacao_pkey" PRIMARY KEY ("user_id","lotacao_id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "lotacao_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "entidade" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3) NOT NULL,
    "last_mirror_ref_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("entidade")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "User_matricula_key" ON "User"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_sisbom_id_key" ON "User"("sisbom_id");

-- CreateIndex
CREATE UNIQUE INDEX "Lotacao_sigla_key" ON "Lotacao"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_user_id_role_lotacao_id_key" ON "UserRole"("user_id", "role", "lotacao_id");

-- AddForeignKey
ALTER TABLE "Lotacao" ADD CONSTRAINT "Lotacao_lotacao_pai_id_fkey" FOREIGN KEY ("lotacao_pai_id") REFERENCES "Lotacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLotacao" ADD CONSTRAINT "UserLotacao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLotacao" ADD CONSTRAINT "UserLotacao_lotacao_id_fkey" FOREIGN KEY ("lotacao_id") REFERENCES "Lotacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_lotacao_id_fkey" FOREIGN KEY ("lotacao_id") REFERENCES "Lotacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

