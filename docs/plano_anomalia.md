# Plano de implementação — Detector estatístico de anomalias

Escrito em 2026-10-12, a partir da "Especificação Inicial do Detector Estatístico de Anomalias" (versão 0.1).
As Fases 1 a 5 e parte da 6 foram implementadas em 12/10/2026 e estão em homologação; o que foi feito, o que
mudou em relação a este plano e o que falta estão no item 16. Os números do item 2 vêm de consultas de leitura ao banco de homologação
(cópia de produção de 10/10/2026, cliente 2, janela de 90 dias: 12/07 a 10/10/2026).

## 1. Objetivo

Indicar à equipe de segurança os veículos cujo padrão de circulação mudou em relação ao próprio histórico e ao
de veículos de perfil parecido, com um score de 0 a 100 acompanhado dos motivos. O resultado prioriza a revisão
humana; não classifica veículo como perigoso e não dispara nenhuma ação automática.

## 2. O que os dados mostram

| Fato | Número | Consequência para o projeto |
|---|---:|---|
| Entradas registradas | 60.130 (≈ 670/dia) | o volume real de viagens é menor que os 1.000/dia da especificação |
| Saídas casadas com entrada por câmera | 56.205 | — |
| Saídas sem entrada (não viram viagem) | 92.161 (62% das saídas lidas) | a maior parte das passagens fica fora de `Trafegos` |
| Viagens com mais de 4 h | 16.405 (29%); 7.671 acima de 24 h | parte é permanência real, parte é saída casada com entrada antiga |
| Viagens com placa de saída diferente | 10.678 (19%) | erro de leitura fragmenta o histórico de um mesmo veículo |
| Baixas manuais (sem leitura de saída) | 3.775 | a duração dessas viagens não é observada |
| Placas distintas | 13.635 | — |
| Placas com 10 ou mais viagens | 964 (7% das placas, 64% das viagens) | o baseline individual vale para poucas placas |
| Placas com uma única viagem | 7.663 (56%) | o baseline por perfil é a regra, não a exceção |
| Destino `cruzar` | 91% das entradas | o destino registrado não descreve o comportamento |
| Portaria de saída igual a uma portaria de entrada | 4.467 viagens | saída manual grava a portaria do operador |

Causas já conhecidas da baixa captura: a câmera Entrada B2 lê cerca de 1 em 5 veículos; a Saída B2 lê veículos
entrando; produção ainda casa placas por aproximação (a versão nova está só em homologação).

A hipótese de que muitas durações longas são associações erradas (saída de hoje casada com entrada de dias
atrás) ainda não foi verificada caso a caso. Verificá-la é a primeira tarefa da Fase 1.

Os horários são gravados em UTC; o servidor de banco está em UTC−3. Toda análise por hora do dia e dia da
semana precisa converter para o fuso do condomínio.

## 3. Decisões tomadas (12/10/2026)

| # | Tema | Especificação | Decisão | Motivo |
|---|---|---|---|---|
| D1 | Unidade de análise | viagens completas | **passagens + viagens**: frequência e horário sobre toda leitura (entrada e saída, casada ou não); duração só sobre viagens que passam no filtro de qualidade | 62% das saídas não viram viagem |
| D2 | Composição do score | soma ponderada `0,35D + 0,25F + 0,20R + 0,20H` | **maior dimensão + reforço** das demais | na soma, uma dimensão no máximo dá 35 e nunca chega à faixa de revisão |
| D3 | Placas sem histórico | perfis "derivados dos dados", sem método | **perfis por regras simples**, recalculados a cada execução | explicável e reproduzível; 93% das placas dependem disso |
| D4 | Onde roda | "integrado à aplicação ou job separado" | **job separado, em lote**, com a mesma imagem do backend | produção é recriada de hora em hora; o fluxo das câmeras não pode ser afetado |
| D5 | Rota | dimensão com peso 20% | **adiada**: registrada como evidência, sem pontuar | 4 combinações e captura falha na Entrada B2 |
| D6 | Mudança persistente | EWMA (6.5) e menção a CUSUM (7.3) | **só EWMA** | um detector só, sem contar a mesma evidência duas vezes |
| D7 | Identidade do veículo | `vehicle_key` | **placa como foi lida**, com marcação de provável erro de leitura | unificar placas próximas pode fundir veículos diferentes |
| D8 | Nomes | inglês (`AnomalyEvents`, `/anomalies`) | **português**, convenção atual | coerência com `Trafegos`, `/saidasNaoIdentificadas` e com o item 8.3 da própria especificação |

## 4. Arquitetura

```
 Trafegos, Saidas_nao_identificadas, WhiteLists, BlackLists, Portarias, Cameras   (somente leitura)
        │
        ▼
 ┌───────────────────────────── job de anomalias (container próprio) ─────────────────────────────┐
 │ 1 passagens   2 viagens válidas   3 perfis e referências   4 analisadores   5 EWMA   6 score   │
 └────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                              ▼
 Anomalia_referencias   Anomalia_estados   Anomalias   Anomalia_revisoes   Anomalia_execucoes
                                              ▲
                          API do backend (/digicam/anomalias...)  ◄──  tela "Anomalias" (Vue)
```

- **Código:** funções estatísticas puras em `backend/services/anomalia/` (a pasta `services` já entra na imagem;
  uma pasta nova na raiz do backend exigiria alterar o Dockerfile). Acesso a dados separado do cálculo.
- **Job:** comando do próprio backend com três modos:
  - `referencias`: uma vez por dia, recalcula perfis e referências;
  - `incremental`: a cada poucos minutos, analisa as passagens e viagens novas desde o último cursor;
  - `retroativo`: reprocessa um período passado, para a validação da Fase 6.
- **Isolamento:** o job lê as tabelas operacionais e grava só nas tabelas `Anomalia_*`. Recomendado um usuário
  de banco próprio, com `SELECT` nas operacionais e escrita só nas novas (critério de aceite 1).
- **Onde executa:** em homologação, como serviço adicional do projeto `digicam-hml`. Em produção, em projeto
  compose separado, alcançando o MySQL pelo IP do host, sem entrar na rede de produção e sem alterar o compose
  de produção. A publicação em produção é uma etapa à parte, com autorização própria.

## 5. Preparação dos dados

### 5.1 Passagem

Uma passagem é uma leitura de placa numa portaria: `(client_id, placa, instante, sentido, portaria, origem)`.

| Origem | Sentido | Placa | Instante |
|---|---|---|---|
| `Trafegos` (toda linha) | entrada | `placa` | `dataEntrada` |
| `Trafegos` com `identificador_placa_saida` preenchido | saída | `placa_saida` | `dataSaida` |
| `Saidas_nao_identificadas` com status diferente de `associada` | saída | `placa` | `data` |

As saídas `associada` já estão no tráfego correspondente e ficam fora para não contar duas vezes. Baixas
manuais não são passagens: nenhuma câmera leu o veículo saindo. O tráfego com baixa manual conta como entrada
sem saída, igual à viagem aberta (decisão de 13/10/2026).

Limitações a registrar no relatório da Fase 1:
- leituras descartadas hoje (sentido contrário ao da câmera, duplicadas) não ficam em nenhuma tabela;
- na saída automática, `dataSaida` é o instante do processamento, alguns segundos depois da leitura.

### 5.2 Viagem válida

Uma viagem entra no cálculo de duração quando:
- tem saída lida por câmera (`identificador_placa_saida` preenchido);
- a saída é posterior à entrada;
- não existe outra passagem da mesma placa entre a entrada e a saída (sinal de saída casada com entrada antiga);
- a duração está abaixo de um teto a definir na Fase 1.

Viagens com placa de saída diferente da de entrada são aceitas com qualidade reduzida. Cada viagem recebe um
motivo de exclusão explícito quando não é válida; entradas sem saída (viagens abertas e baixas manuais) ficam
fora (item 8.4).

### 5.3 Identidade e erro de leitura

A chave do veículo é a placa lida, normalizada (maiúsculas, só letras e números). Uma placa com uma única
passagem e a 1 caractere de distância de uma placa frequente do mesmo cliente é marcada como provável erro de
leitura: não gera alerta de "placa nova" e não entra em referências. A regra reaproveita
`backend/services/placaUtil.js`.

## 6. Modelo estatístico

Todos os números abaixo são parâmetros iniciais, a calibrar na Fase 6.

### 6.1 Janelas

Recente: 30 dias. Referência: 90 dias. Ampliada: 180 dias. A viagem ou passagem avaliada nunca entra na
amostra da própria referência, e nenhuma referência usa dado posterior ao evento avaliado.

### 6.2 Perfis por regras

Calculados por placa sobre a janela de referência:

| Perfil | Regra inicial |
|---|---|
| `novo` | nenhuma passagem anterior |
| `esporadico` | menos de 10 passagens |
| `travessia_frequente` | 10 ou mais viagens válidas, ao menos 75% com até 10 minutos |
| `permanencia` | 10 ou mais viagens válidas, ao menos 75% acima de 10 minutos |
| `misto` | 10 ou mais viagens válidas, sem predominância |

A red list entra como contexto exibido no alerta, não como perfil. As placas da green list não são avaliadas
(decisão de 13/10/2026; ver item 16.3), mas as passagens delas continuam compondo a referência dos perfis. A
referência do perfil é a distribuição conjunta das placas daquele perfil.

### 6.3 Referência aplicável

- 30 ou mais viagens válidas: referência individual.
- 10 a 29: individual, marcada como preliminar.
- menos de 10: referência do perfil, com a indicação "histórico insuficiente" no resultado.

### 6.4 Duração (D)

Mediana e MAD das durações válidas; desvio robusto `z = 0,6745 × (t − m) / MAD`. Com MAD zero ou muito pequeno,
usa-se uma dispersão mínima (fração da mediana, a definir) e, na falta dela, os percentis do perfil. Aumentos e
reduções são registrados com sinal.

### 6.5 Frequência (F)

Sobre passagens: contagem por placa em 1 hora, 24 horas e 7 dias, comparada com a distribuição das mesmas
janelas no histórico da placa e no perfil. Considera valor absoluto e variação relativa.

Cuidado obrigatório: quando a captura mudar (reposicionamento da Entrada B2, publicação da conciliação nova),
as contagens sobem para todos. Cada mudança dessas gera nova versão do modelo e um período de recalibração, em
que alertas de frequência ficam suspensos.

### 6.6 Horário (H)

Histograma por placa e por perfil em 24 faixas horárias, separado em dia útil e fim de semana, no fuso do
condomínio, com suavização para amostras pequenas. A pontuação vem da raridade da faixa da passagem avaliada.
Feriados não são tratados na primeira versão (ver P6).

### 6.7 Normalização

Cada dimensão vira um valor de 0 a 100 por uma curva única e documentada: 0 até `|z| = 2`, 60 em `|z| = 3`,
100 em `|z| = 6`, linear entre os pontos. Dimensões sem desvio robusto (horário) usam o percentil equivalente.

### 6.8 Mudança persistente (P)

EWMA com `λ = 0,2` sobre os desvios normalizados de duração e de frequência. Como as passagens são irregulares,
o valor anterior decai conforme o tempo desde a última observação, e um intervalo longo sem passagens reinicia
a série. A persistência só é considerada com desvios em pelo menos 3 viagens ou dias distintos.

### 6.9 Score

```
principal = maior entre D, F e H
reforco   = média ponderada das outras dimensões (pesos 35 / 25 / 20 de D / F / H)
S0        = principal + (100 − principal) × 0,5 × reforco / 100
S         = S0 + (100 − S0) × 0,3 × P / 100
```

Uma dimensão extrema sozinha já alcança a faixa de revisão; as demais e a persistência só aumentam a
prioridade. Os fatores 0,5 e 0,3 são hipóteses iniciais. O alerta guarda a dimensão principal e a contribuição
de cada parcela, para a explicação na tela.

Faixas iniciais: 0–29 normal, 30–59 observação, 60–79 revisão, 80–100 prioridade alta. Só geram alerta os
scores a partir de 30; o limite é calibrado pela carga de revisão aceitável (P4).

### 6.10 Qualidade dos dados

Registrada separada do score, por alerta: tipo de referência (individual, preliminar, perfil), quantidade de
viagens e passagens usadas, placa de saída diferente, provável erro de leitura. Com dados insuficientes o
resultado diz isso em vez de mostrar um número; a qualidade nunca altera o score.

## 7. Persistência

Nomes em português, no padrão do sistema. A especificação propõe três tabelas; este plano acrescenta duas
(`Anomalia_estados` e `Anomalia_execucoes`), necessárias para o EWMA incremental, a idempotência e as métricas.

| Tabela | Conteúdo | Campos principais |
|---|---|---|
| `Anomalia_referencias` | referências por placa e por perfil | `client_id`, `chave_veiculo` (nulo para perfil), `perfil`, `janela_inicio`, `janela_fim`, `qtd_viagens`, `qtd_passagens`, `duracao_mediana`, `duracao_mad`, `duracao_p95`, `duracao_p99`, `dados` (JSON validado), `versao_modelo`, `calculado_em` |
| `Anomalia_estados` | estado corrente por placa | `client_id`, `chave_veiculo`, `ewma_duracao`, `ewma_frequencia`, `ultima_passagem_em`, `versao_modelo` |
| `Anomalias` | alertas | `client_id`, `trafego_id` (quando houver), `chave_veiculo`, `chave_deduplicacao` (única), `tipo`, `ocorrido_em`, `score`, `score_duracao`, `score_frequencia`, `score_horario`, `score_rota` (nulo na v1), `score_persistencia`, `qualidade_dados`, `motivos`, `evidencias`, `versao_modelo`, `status` |
| `Anomalia_revisoes` | decisões dos revisores | `client_id`, `anomalia_id`, `user_id`, `resultado`, `motivo`, `revisado_em` |
| `Anomalia_execucoes` | registro de cada execução do job | `modo`, `client_id`, `inicio`, `fim`, `cursor`, contagens, erros, `versao_modelo` |

- **Status do alerta:** `ABERTA`, `REVISADA`, `DESCARTADA`, `CONFIRMADA`. `CONFIRMADA` significa relevância
  operacional confirmada pelo revisor, não confirmação de crime.
- **Deduplicação:** `chave_deduplicacao` = cliente + placa + tipo + (id do tráfego ou início da janela) +
  versão do modelo. Reprocessar atualiza o alerta existente em vez de criar outro.
- **Reprodutibilidade:** o alerta guarda em `evidencias` os valores de referência usados (mediana, MAD,
  contagens, faixa horária), além da versão do modelo.
- **Volume:** referências individuais só são gravadas para placas com 10 ou mais viagens (cerca de 1.000 hoje);
  instantâneos antigos são removidos conforme a retenção definida em P5.
- **Índices iniciais:** `(client_id, chave_veiculo, calculado_em)`, `(client_id, status, score, createdAt)` e
  `(client_id, anomalia_id, revisado_em)`, revistos com os planos de execução reais.

As migrações de `Trafegos` não são necessárias: nenhuma tabela operacional é alterada.

## 8. Processamento

### 8.1 Referências (diário)

Lê passagens e viagens da janela, aplica os filtros do item 5, calcula perfis e referências, grava com período
e versão, registra a execução.

### 8.2 Incremental (a cada poucos minutos)

Para cada passagem ou viagem concluída depois do cursor: valida, carrega a referência aplicável, calcula D, F
e H, atualiza o EWMA, compõe o score, grava ou atualiza o alerta, avança o cursor. O atraso entre o evento e o
alerta é o intervalo do job mais o tempo de processamento, e é medido (item 11).

### 8.3 Idempotência

Garantida pela chave única de deduplicação e pelo cursor gravado em `Anomalia_execucoes`. Duas execuções
simultâneas são evitadas por trava no banco.

### 8.4 Entradas sem saída (viagens abertas e baixas manuais)

A baixa manual tem data de saída, mas nenhuma câmera leu o veículo saindo: é tratada como entrada sem saída,
junto com as viagens abertas. Fora da distribuição de durações. A análise de permanência em aberto (tempo desde a entrada) fica para depois
da primeira versão; a tela de Tráfego já sinaliza permanência acima de 3 minutos em travessia.

## 9. API

Prefixo `/digicam`, autorização por cliente como nas rotas atuais (administrador do sistema vê todos; usuário
de cliente só o próprio).

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/anomalias/client/{id}` | listar alertas, com filtros de período, faixa e status, e paginação |
| GET | `/anomalias/{id}` | alerta com evidências e revisões |
| GET | `/anomalias/client/{id}/placa/{placa}` | histórico estatístico da placa naquele cliente |
| POST | `/anomalias/{id}/revisao` | registrar a revisão |
| GET | `/anomalias/client/{id}/metricas` | métricas do detector |

A consulta por placa leva o cliente na rota, o que impede acesso a registros de outro condomínio.

## 10. Interface

Tela nova "Anomalias" no menu, sem alterar as telas operacionais.

- **Lista:** placa, data e hora, score e faixa, dimensão principal, motivos em texto, status; filtros por
  período, faixa e status.
- **Detalhe:** o que foi observado ao lado da referência (duração × mediana histórica, passagens recentes ×
  habituais, horário × horários habituais), rota como informação, quantidade de viagens da referência,
  qualidade dos dados, histórico temporal do veículo com fotos, revisões anteriores.
- **Revisão:** resultado (relevante, descartado) e motivo.

A explicação sempre mostra os fatores que formaram a pontuação antes do número.

## 11. Testes, validação e métricas

- **Unitários** (funções puras): mediana, MAD, MAD zero, desvio, normalização, janelas de frequência,
  histograma de horário, EWMA com intervalos irregulares, composição do score, amostra insuficiente, exclusão
  da viagem avaliada. O backend não tem executor de testes unitários hoje; usar o `node:test` nativo, sem
  dependência nova.
- **Integração:** no padrão de `backend/tests/integracao/`, com MySQL descartável: leitura por cliente,
  passagens das três origens sem duplicar, viagens inválidas e abertas, gravação e atualização de alertas,
  idempotência (rodar duas vezes), revisão, isolamento entre clientes.
- **Retrospectiva:** referências construídas com um período inicial e detector avaliado no período seguinte,
  pelo modo `retroativo`, sem usar dados futuros.
- **Modo sombra:** o job roda e grava alertas sem nenhum efeito operacional; a equipe revisa uma amostra de
  alertas e uma amostra de eventos não alertados.
- **Métricas:** alertas por dia e por faixa, proporção considerada relevante, falsos positivos na amostra,
  percentual de viagens válidas, inválidas (por motivo) e abertas, atraso entre evento e alerta, variação das
  referências entre execuções, tempo médio de revisão, alertas duplicados (esperado: zero).

Sem histórico rotulado de incidentes, o piloto mede se os alertas apontam comportamento atípico e se são úteis
à equipe, não a capacidade de prever crimes.

## 12. Fases

Estimativa em dias úteis de um desenvolvedor, a rever depois da Fase 1.

| Fase | Entrega | Estimativa |
|---|---|---:|
| 1. Auditoria de dados | relatório de qualidade; regras e teto de duração das viagens válidas; confirmação da hipótese das durações longas | 4 |
| 2. Passagens, viagens e referências | funções estatísticas com testes; migrações das tabelas; job `referencias`; perfis | 8 |
| 3. Analisadores | duração, frequência e horário; EWMA; testes | 7 |
| 4. Score e alertas | composição, deduplicação, job `incremental`, registro de execuções | 5 |
| 5. API e tela | rotas, tela de lista, detalhe e revisão | 8 |
| 6. Validação | modo `retroativo`, análise retrospectiva, modo sombra em homologação, calibração | 8 |
| 7. Implantação controlada | job em produção, monitoramento, limites calibrados | 3 |
| **Total** | | **43** |

A Fase 1 pode mudar o plano: se a maior parte das durações for inválida, a duração entra só como dimensão de
reforço até a captura melhorar.

## 13. Critérios de aceite

Os dez critérios do item 15 da especificação valem como estão, com dois ajustes decorrentes das decisões:
"viagens" passa a incluir passagens (D1), e a rota não pontua na primeira versão (D5).

## 14. Riscos

| Risco | Mitigação |
|---|---|
| O detector apontar falha de câmera em vez de comportamento | filtro de viagem válida, análise por passagens, suspensão de alertas de frequência na recalibração |
| Mudança de captura invalidar as referências | versão do modelo e período de recalibração a cada mudança |
| Erro de leitura gerar "placas novas" | marcação de provável erro de leitura (item 5.3) |
| Volume de alertas acima do que a equipe revisa | limite de geração calibrado no modo sombra (P4) |
| Job concorrer com a operação | container próprio, consultas por janela, usuário de banco de leitura |
| Produção ainda na versão antiga | o detector lê `Saidas_nao_identificadas` sem depender da coluna `status` quando ela não existir, ou a publicação da conciliação vem antes (P1) |

## 15. Decisões pendentes

| # | Decisão | Recomendação |
|---|---|---|
| P1 | Base do desenvolvimento: branch nova a partir de `feature/abas-trafego-conciliacao` ou de `develop` | a partir da feature, que traz `status` em `Saidas_nao_identificadas` e o utilitário de placas; publicar a conciliação em produção antes do detector |
| P2 | Veículos da green list entram na análise? | entram, com o contexto exibido; alertas deles podem ter limite mais alto |
| P3 | Quem revisa e quem só consulta | administrador do sistema e do cliente revisam; operador não vê a tela na primeira versão |
| P4 | Volume máximo aceitável de alertas por dia | definir com a equipe antes do modo sombra |
| P5 | Retenção de alertas, revisões e referências, e base legal (LGPD) | definir com o cliente; a pseudonimização no processamento fica em aberto, já que a tela precisa exibir a placa |
| P6 | Feriados | sem calendário na primeira versão; avaliar depois da retrospectiva |
| P7 | Fuso do condomínio | configurável por cliente, com o padrão atual do backend |
| P8 | Histórico de incidentes ou revisões de segurança para comparar | perguntar ao cliente; sem ele, vale só a avaliação do modo sombra |
| P9 | Critérios para considerar um alerta relevante | escrever com a equipe de segurança antes da Fase 6 |

## 16. Resultados da implementação (12/10/2026)

Branch `feature/detector-anomalias`, publicada só em homologação (versão `r47`). Produção não foi tocada.

### 16.1 O que foi entregue

| Fase | Situação | Onde |
|---|---|---|
| 1. Auditoria de dados | feita (item 16.2) | — |
| 2. Passagens, viagens e referências | feito | `backend/services/anomalia/preparacao.js`, `motor.js`, `dados.js`; migração `20261013000000-detector-anomalias` |
| 3. Analisadores | feito (duração, frequência, horário, EWMA) | `backend/services/anomalia/estatistica.js`, `motor.js` |
| 4. Score e alertas | feito | `motor.js`, `job.js`, `executar.js` |
| 5. API e tela | feito | `routes/anomalia.route.js`, `services/anomalia/consulta.js`, `frontend/src/pages/anomalias/Anomalias.vue` |
| 6. Validação | parcial: simulação retrospectiva e job em modo sombra no HML; falta a revisão pela equipe e a calibração | — |
| 7. Implantação controlada | não feita | — |

- **Job:** serviço `anomalias` no compose de homologação (`node services/anomalia/executar.js --modo=servico`),
  um ciclo por minuto, referências uma vez por dia. Uma carga de 104 dias leva cerca de 2 s. Desde 13/10/2026
  não há carga retroativa: o veículo é avaliado quando entra ou sai, e a primeira execução só forma o estado
  e marca o ponto de partida. (A carga inicial de 30 dias usada até então avaliou 66.081 passagens e gravou
  1.508 alertas em 25 s; esses alertas foram apagados do HML.) O modo `retroativo` continua disponível à mão.
- **Testes:** 22 testes unitários (`npm run test:unitario`, `node:test` nativo) e 44 verificações de
  integração (`npm run test:integracao:anomalias`), mais as 90 do teste de conciliação, sem regressão.

### 16.2 Auditoria de dados (Fase 1)

Janela de 90 dias até 10/10/2026, 60.130 tráfegos e 92.161 saídas sem entrada:

| Situação da viagem | Quantidade | Tratamento |
|---|---:|---|
| Válida | 42.679 | entra no cálculo de duração |
| Passagem intermediária | 13.283 | excluída |
| Sem saída (409 abertas e 3.759 baixas manuais) | 4.168 | excluída |
| Saída antes da entrada | 0 | — |

- **Hipótese das durações longas confirmada em parte:** das viagens com mais de 24 horas, 5.310 têm outra
  leitura da mesma placa no meio (saída casada com entrada antiga) e 2.166 não têm. O filtro de passagem
  intermediária retira a maior parte; o teto de 24 horas retira o restante.
- **Leitura dupla na saída:** 2.226 viagens de menos de 3 minutos tinham outra leitura da placa "no meio". A
  explicação provável, não conferida caso a caso, é o mesmo veículo lido pelas duas câmeras de saída. Por isso
  uma leitura de saída até 10 minutos antes da saída do tráfego não invalida a viagem.
- **Placas inválidas:** cerca de 7% das leituras não têm formato de placa (por exemplo `UNKNOWN`) e são
  descartadas na preparação.
- **Histórico individual:** 827 placas têm 10 ou mais viagens válidas (251 têm 30 ou mais); 2.815 têm 10 ou
  mais passagens.

### 16.3 O que mudou em relação a este plano

| Tema | Plano | Implementado | Motivo |
|---|---|---|---|
| Alerta | um por evento, com chave por tráfego ou janela | **um por placa e por dia** (o evento de maior score); os demais do dia viram contagem | volume e leitura mais simples para o revisor |
| Anomalia que persiste | "atualizar o alerta existente" | nos 7 dias seguintes, a mesma placa e dimensão só gera novo alerta se o score subir 10 pontos; senão a repetição é anotada no alerta original | sem isso, uma mudança de frequência semanal gerava um alerta por dia |
| Perfis | cinco | seis: acrescentado `recorrente` (10 ou mais passagens, menos de 10 viagens válidas) | as regras do plano não cobriam esse caso |
| Referência do perfil | pontua normalmente | dimensão calculada pelo perfil tem teto (59 para duração e frequência, 25 para horário) | histórico insuficiente não deve produzir prioridade alta sozinho; horário do perfil era só ruído |
| Horário | raridade a partir de 5% | raridade a partir de 2% (60 pontos em 0,5%) | com 5%, quase toda hora pouco usada pontuava |
| Frequência | dispersão mínima de 1 | mínimos maiores (1,5 no dia, 3 na semana) e diferença absoluta mínima (4, 4 e 6 passagens) | a captura irregular das câmeras faz as contagens variarem muito |
| Janela ampliada de 180 dias | prevista | não usada | os analisadores usam só a janela de 90 dias |
| Incremental | cursor | cursor com margem de consolidação de 10 minutos | saídas sem entrada só são gravadas 3 minutos depois da leitura |
| Usuário de banco próprio | recomendado | não criado: o job usa o usuário da aplicação | fica para a implantação |
| Primeira execução | não especificada; implementada com carga dos últimos 30 dias | **sem carga retroativa** (13/10/2026): só são avaliados os veículos que entram ou saem dali em diante; ciclo de 1 minuto no HML | decisão do usuário: calcular sob demanda, não em lote sobre o passado |
| Green list (P2) | entra na análise, com o contexto exibido | **não é avaliada** (13/10/2026): placa que está na green list atual do cliente não gera alerta; modelo `1.1.0` | decisão do usuário |
| Baixa manual | categoria própria, excluída | conta como **entrada sem saída**, junto com a viagem aberta (13/10/2026); o histórico do veículo mostra "sem saída" | decisão do usuário: sem leitura de câmera, a saída não foi observada. A pontuação não muda |

Os parâmetros estão todos em `backend/services/anomalia/parametros.js`, com a versão do modelo (`1.1.0` desde que a
green list deixou de ser avaliada; `1.0.0` antes).

### 16.4 Volume observado

Simulação retrospectiva de 14 dias (26/09 a 09/10/2026), com os parâmetros atuais:

| Faixa | Alertas por dia (média) |
|---|---:|
| Observação (30–59) | 30 |
| Revisão (60–79) | 9 |
| Prioridade alta (80–100) | 13 |

Antes dos ajustes do item 16.3 eram cerca de 300 por dia. Dimensão principal dos alertas a partir de 60:
duração em 184, frequência em 101 e horário em 27. Em 14 dias, 292 ocorrências viraram repetição de alerta
anterior e 285 leituras foram tratadas como provável erro de leitura.

Esses números não foram revisados por ninguém da operação: mostram a carga de revisão, não a qualidade dos
alertas.

A auditoria e a simulação rodaram antes da correção de um erro de fuso na carga do histórico (os limites do
período eram deslocados em 3 horas). O efeito sobre os totais de 90 e de 14 dias é marginal, mas os números
não foram recalculados depois da correção.

### 16.5 O que falta

- **Calibração com a equipe (Fase 6):** revisar uma amostra de alertas e de eventos não alertados, definir o
  volume aceitável (P4) e o critério de relevância (P9), ajustar limiares e pesos.
- **Decisões pendentes do item 15:** foram seguidas as recomendações (só administradores veem e revisam; sem
  feriados; fuso do container), exceto na green list, que não é avaliada. Retenção e LGPD (P5) continuam abertas:
  só as referências têm limpeza automática (180 dias).
- **Implantação em produção (Fase 7):** depende de publicar a conciliação nova, aplicar as migrações e subir o
  job em projeto compose próprio, com usuário de banco de leitura.
- **Entradas sem saída** (viagens abertas e baixas manuais) e **rota** continuam fora da pontuação, como
  planejado.
- **Auditoria de consulta:** as revisões ficam registradas com o revisor; as consultas aos alertas não.
