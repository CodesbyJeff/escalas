import { createFileRoute } from '@tanstack/react-router';
import { CatalogoFuncoes } from '../../features/funcaoPatentes/CatalogoFuncoes';

export const Route = createFileRoute('/_app/funcao-patentes/')({ component: CatalogoFuncoes });
