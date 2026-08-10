# Ciclo 2d — Política de Localidade (rodízio e fixação) — Design

**Data:** 2026-08-10
**Contexto:** Última perna declarada do Ciclo 2. O balanço ESAON (01/07) define o ciclo como *"geração em bloco 24h×72h **+ rodízio de guarnições/locais do GBSA** por equidade"*. A geração em bloco (2a), a elegibilidade (2b) e o motor de preenchimento (2c) foram entregues; o rodízio nunca virou fatia. Hoje o motor equilibra **quantos** serviços cada militar tirou, mas não **onde** — e "onde" tem regra oposta nas duas famílias operacionais: no GBSA o militar deve girar entre as praias; no quartel ele pertence à sua guarnição e não sai dela.

**Fonte de domínio:** escala real do BSA de 08 a 11/08/2026 (4 dias consecutivos, publicada pelo escalante do BSA), lida nesta sessão, mais as regras de turma confirmadas com o usuário.

## O que a escala real mostrou

- **GBSA: ciclo 24×48, três turmas.** O serviço ordinário de cada militar cai de 3 em 3 dias: 08 e 11 são a mesma turma; 09 e 12 outra; 10 e 13 a terceira. Tudo que aparece nos dias intermediários vem marcado `(D.O.)`.
- **A turma se mantém, a praia não.** Comparando o efetivo ordinário de 08 com o de 11, 12 dos ~14 guarda-vidas são as mesmas pessoas — mas quase ninguém repete o posto. A Redinha do dia 08 (FELIPE, THIAGO, BORBA) é outra no dia 11 (BRUNO, BEZERRA, SOARES); RAWLINSON sai de Areia Preta para Búzios; GURGEL sai de operador de viatura na Praia do Meio para comandar Ponta Negra.
- **Não é permutação rígida.** PONTES ficou em Búzios nas duas voltas e o fiscal trocou de WELLINGTON para VALTER. O rodízio é equidade com folga, não rotação circular.
- **Quartel: ciclo 24×72, quatro turmas** (alfa/bravo/charlie/delta), **sem rodízio** — quem é do incêndio permanece no incêndio. Regra confirmada com o usuário; é o inverso exato do GBSA.
- **Turnos encadeados não são conflito.** As praias rodam 07:00→17:00 e o PGV01 é permanência a partir das 17h. O almoxarife fica no almoxarifado até a última praia devolver o material e depois compõe a guarnição noturna — um plantão de 24h com dois postos **em sequência**. O padrão se repete nos quatro dias (JOHN, CARNEIRO, HERONIDES, KENNEDY). `Vaga.turno_inicio`/`turno_fim` já representam isso; nada a mudar no modelo.

## Decisões trancadas (aprovadas com o usuário)

- **A localidade vira dimensão da equidade, com política por layout.** Três estados:
  - **`rodizia`** — vence quem tirou **menos** serviços naquela guarnição (GBSA).
  - **`fixa`** — vence quem **já serviu** naquela guarnição; entre eles, a equidade normal decide (quartel).
  - **`indiferente`** — a localidade não entra no ranqueio. **Default**, e comportamento idêntico ao de hoje.
- **`fixa` é pertencimento, não placar.** O sinal é binário (`já serviu ali` sim/não), não a contagem. Usar a contagem faria o veterano com mais serviços na guarnição ser sempre o primeiro chamado e transformaria a fixação numa corrida; o binário mantém o rodízio justo **dentro** da guarnição.
- **Localidade = `EscalaGuarnicao.atividade`**, normalizada. É a chave que o importador do mapa de força já grava: no GBSA vale a praia (Ponta Negra, Miami, Redinha…), no quartel vale a atividade/viatura (INCÊNDIO, RESGATE, SALVAMENTO).
- **Política mora no layout, não na execução.** É característica permanente da lotação — quartel é fixo por definição operacional, GBSA rodizia sempre — então o campo fica no `TemplateLotacao`.
- **Conflito de turno continua sendo a única barreira dura.** Sem afrouxamento.
- **Avisos continuam soft** (patente, descanso) e o motor segue **determinístico** (sem `Date.now`/random; desempate final por `militar_id`).
- **Turma (alfa/bravo/charlie/delta) não vira modelo.** Ela emerge do descanso: com `descanso_horas = 48` e turno de praia 07→17, quem serviu no dia 8 só volta a ficar elegível a tempo do dia 11 (GBSA, 3 turmas); com `descanso_horas = 72` e turno 24h, o espaçamento vira 4 dias (quartel, 4 turmas). Foi o que o dado real mostrou, inclusive com a folga que uma turma rígida não teria.
- **No GBSA o escalante roda o motor no mês inteiro, não usa `repetirCiclo`.** `repetirCiclo` copia o dia `i % K` literalmente — é a ferramenta dos quartéis, onde repetir na íntegra é justamente o que se quer. Nenhuma mudança nele.

## Arquitetura

### Modelo — `apps/backend/prisma/schema.prisma`
Enum novo e uma coluna em `TemplateLotacao`:

```prisma
enum PoliticaLocalidade {
  indiferente
  rodizia
  fixa
}

// em TemplateLotacao:
politica_localidade PoliticaLocalidade @default(indiferente)
```

Migration `0012_layout_politica_localidade`. O default preserva todos os layouts existentes; marca-se `rodizia` no layout do GBSA e `fixa` nos layouts dos quartéis.

### Serviço — `apps/backend/src/services/preenchimento.service.ts`
- **Lê a política:** `escala.template_id` → `TemplateLotacao.politica_localidade`. `template_id` é nullable (`ON DELETE SET NULL`); nulo ⇒ `indiferente`.
- **Contagem por localidade:** as duas consultas que hoje montam `contagemInicial` (vagas desta escala + vagas de escalas `publicada`/`aprovada` anteriores da mesma lotação) passam a trazer também a atividade da guarnição — `select: { militar_id: true, guarnicao: { select: { atividade: true } } }` — e alimentam um segundo mapa `contagemLocalInicial: Map<number, Map<string, number>>`, chaveado por `militar_id` → localidade normalizada → contagem.
- **A fonte não muda.** Mesmas escalas, mesmo recorte temporal, mesma regra de status. Só o agrupamento é novo. O mesmo mapa serve às duas políticas: `rodizia` lê o número, `fixa` lê apenas se é maior que zero.
- `sugerir` e `aplicar` continuam com a mesma assinatura e o mesmo contrato (preview puro / gravação transacional em vaga ainda aberta, auditada).

### Núcleo puro — `apps/backend/src/utils/preenchimento.ts`
- `VagaAberta` ganha `guarnicao_atividade: string`.
- `PlanoInput` ganha `contagemLocalInicial: Map<number, Map<string, number>>` e `politicaLocalidade: 'indiferente' | 'rodizia' | 'fixa'`.
- A normalização da localidade reusa `normalizeFuncao` de `utils/funcao.ts` — apesar do nome, a função é um normalizador genérico de rótulo (NFD, sem acento, espaços colapsados, caixa alta). Reusar evita uma segunda convenção de normalização divergindo com o tempo.
- O candidato ganha `contagemLocal` — a contagem daquele militar **na localidade desta vaga**, resolvida a cada vaga a partir de `guarnicao_atividade` normalizada. O `sort` ganha **um** critério, imediatamente antes do total:

```ts
const porLocalidade = (a: Cand, b: Cand) => {
  if (input.politicaLocalidade === 'rodizia') return a.contagemLocal - b.contagemLocal;
  if (input.politicaLocalidade === 'fixa') return Number(b.contagemLocal > 0) - Number(a.contagemLocal > 0);
  return 0;
};

cands.sort((a, b) =>
  Number(a.violaDescanso) - Number(b.violaDescanso) ||
  Number(b.patenteOk) - Number(a.patenteOk) ||
  porLocalidade(a, b) ||
  a.contagem - b.contagem ||
  a.id - b.id);
```

Com `indiferente` o termo é constante zero e a ordenação é idêntica à de hoje.

- **Atualização incremental:** ao atribuir, além de `contagem`, incrementa `contagemLocal` do militar escolhido naquela localidade — a política precisa valer **dentro da mesma rodada**, não só contra o histórico. É o que faz o motor espalhar as praias ao longo do mês numa única execução; sob `fixa`, é o que faz o militar recém-alocado a uma guarnição passar a pertencer a ela para os dias seguintes.
- **`motivo`:** a explicação cita a localidade conforme a política — `"menos serviços em Praia de Ponta Negra (1) · …"` sob `rodizia`, `"é do INCÊNDIO · …"` sob `fixa`, e a string atual sob `indiferente`. Exibe a **atividade original** da guarnição, não a chave normalizada: a chave serve para contar, o motivo para o escalante ler.

### API / DTO
**O contrato do motor não muda.** A política vem do layout, não do corpo da requisição: `preenchimentoInputSchema` (`data_ini`, `data_fim`, `descanso_horas?`) e `PreenchimentoSugestaoDTO` ficam intactos, e os dois endpoints (`POST /escalas/:id/sugerir-preenchimento` e `/aplicar-preenchimento`) mantêm assinatura e resposta.

**O CRUD de layouts muda:** `POST`/`PUT /api/v1/templates/:id` passa a aceitar e devolver `politica_localidade`; o schema Zod do layout ganha o enum com default `indiferente`.

### Web — `apps/web`
- **Editor de layout:** um `SegmentedControl` do Mantine com os três estados e uma linha de apoio por opção — *"Rodiziar: o militar gira entre as guarnições (praias do GBSA)"* · *"Fixar: o militar permanece na guarnição dele (incêndio, resgate)"* · *"Indiferente: a guarnição não influencia a escolha"*.
- **Cartão de preenchimento automático:** sem campo novo. A coluna *Motivo* da tabela de preview já mostra a explicação, que passa a citar a guarnição quando a política é `rodizia` ou `fixa`.

## Escopo / não-escopo

**Em escopo:** enum + coluna no layout + migration, contagem por localidade no serviço, critério de política no núcleo puro, campo no CRUD de layouts, seletor no editor de layout, testes.

**Fora:**
- Conceito de turma/equipe (alfa/bravo/charlie/delta) no modelo — emerge do descanso.
- Afrouxar conflito de turno — continua duro.
- Mudanças em `repetirCiclo` ou `carimbarEstrutura`.
- Rodízio ponderado por peso de localidade (praia movimentada × posto calmo) — se a operação pedir, é fatia própria.
- Marcar D.O. na vaga preenchida (ver Achados).

## Testes

**Núcleo puro (Vitest):**
- `rodizia`: entre dois militares com o mesmo total, vence o que tirou menos naquela localidade.
- `rodizia`: entre dois com a mesma contagem local, o total desempata.
- `rodizia` espalha as localidades **dentro de uma única rodada** (militar escalado em Ponta Negra no dia 1 não é o primeiro candidato a Ponta Negra no dia 4, tendo par disponível).
- `fixa`: quem já serviu no INCÊNDIO vence quem nunca serviu, **mesmo tendo mais serviços no total**.
- `fixa`: entre dois que já serviram no INCÊNDIO, vence o de menor total (equidade preservada dentro da guarnição).
- `fixa`: veterano com 20 serviços na guarnição não ganha do colega com 2 — o sinal é binário, não placar.
- `indiferente` produz saída **idêntica** à de hoje — teste de regressão sobre um caso já existente da suíte.
- Conflito de turno continua hard sob as três políticas.
- Determinismo preservado (mesma entrada, mesma saída; desempate por `militar_id`).
- Localidade normalizada: `"Ponta Negra"` e `"PONTA  NEGRA"` contam como a mesma.

**Serviço/integração:**
- Contagem local considera escala anterior `publicada`/`aprovada` da mesma lotação, com o mesmo recorte da contagem total.
- Layout `indiferente` (e escala com `template_id` nulo) não altera comportamento.
- `aplicar` continua gravando só em vaga aberta e auditando.

**Web:**
- O seletor persiste no layout (salvar e reabrir).
- O preview exibe o motivo com a guarnição sob `rodizia` e sob `fixa`.

## Riscos

- **Militar novo sob `fixa`.** Quem não tem histórico em nenhuma guarnição perde para qualquer um que tenha, e o motor nunca o escala. É o comportamento correto para uma regra de pertencimento, mas significa que **a primeira alocação de um militar novo é manual** — o escalante o coloca uma vez e, a partir dali, ele pertence. Documentar no texto de apoio do seletor.
- **Chave de localidade instável.** Se o `atividade` da guarnição for editado à mão num dia (ex.: `"Ponta Negra I"` × `"Ponta Negra"`), a contagem se divide em duas. Mitigação: normalização compartilhada; o layout gerado do mapa de força é idempotente e mantém a string estável.
- **Pool pequeno numa localidade específica.** Onde a função exige qualificação concentrada (MERGULHADOR, SUP_MERGULHO), o critério de localidade pode empurrar para fora quem de fato deve estar ali. Como patente é critério **anterior** à política no ranqueio, a elegibilidade continua vencendo — mas vale observar no uso real.
- **Primeira execução sem histórico.** Numa lotação sem escala anterior publicada, toda contagem local começa zerada: sob `rodizia` a primeira escala sai menos rodiziada que as seguintes; sob `fixa`, ninguém pertence a nada e o ranqueio cai no total. Ambos convergem depois da primeira escala publicada.

## Achados registrados (fora desta fatia)

- **`Vaga` não guarda que foi preenchida como D.O.** O Ciclo 1 decidiu *"DO = `militar_id == null`; não há flag nova"*. Como o D.O. só existe enquanto a vaga está aberta, no instante em que alguém a preenche a informação some — e a escala que o BSA publica traz `(D.O.)` ao lado de ~15 dos 40 nomes do dia. É uma coluna `do` na `Vaga`, escrita quando a inscrição fechar. Pertence ao Sprint 24 (Oferta/Inscrição de DO), não ao Ciclo 2.
- **Sprint 23 ("Criação flexível de escala — período/semanal") não tem trabalho.** O usuário decidiu manter **uma escala por mês**; a parte útil da sprint — aplicar um layout a uma faixa de dias — já foi entregue no 2a por `carimbarEstrutura(escala_id, data_ini, data_fim, template_id, …)`. A sprint deve ser encerrada ou cancelada no quadro 286.

## Relacionados
- `docs/superpowers/specs/2026-07-03-ciclo2c-motor-preenchimento-design.md` (o motor que esta fatia estende)
- `docs/superpowers/specs/2026-07-01-ciclo2a-geracao-bloco-design.md` (`repetirCiclo`, `carimbarEstrutura`)
- Vault: `2026-07-01 - ESCALAS - BALANCO GERAL E REORGANIZACAO (ESAON)` · `2026-07-01 - ANALISE ESCALAS - MAPA DE FORCA SISBOM = ESCALA EXECUTADA (dominio Ciclo 2)`
