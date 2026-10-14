# Tipos de anomalia — guia para o operador

Este guia explica, em linguagem simples, cada tipo de alerta que aparece na tela **Anomalias**: o que ele quer
dizer, um exemplo, as explicações comuns que não são problema e o que vale conferir antes de decidir.

## Antes de tudo: o que é uma anomalia

O sistema aprende, ao longo do tempo, como cada veículo costuma usar a portaria: em que horários passa,
quantas vezes por dia, quanto tempo fica lá dentro. Ele usa os **últimos 90 dias** de passagens de cada placa.

Uma **anomalia** é uma passagem que foge desse costume. **Não quer dizer que algo errado aconteceu.** Na
maioria das vezes há uma explicação simples (uma visita, uma obra, uma viagem, uma mudança de rotina). O alerta
serve para chamar a atenção do operador, que olha as fotos e o histórico e decide se aquilo merece atenção.

Algumas regras gerais:

- **Veículos da green list não geram alerta.**
- Uma placa gera **no máximo um alerta por dia**. Se ela teve várias passagens estranhas no mesmo dia, o alerta
  mostra a mais forte e informa quantas foram.
- Se a mesma placa repete a mesma estranheza nos dias seguintes (até 7 dias), o sistema **não cria um alerta
  novo** a cada dia. Ele anota no alerta que já existe: aparece "**repetiu em N dia(s)**". Só nasce um alerta
  novo se a situação ficar bem mais forte que a anterior.
- Uma placa lida uma única vez e quase igual à de um veículo conhecido (um caractere diferente) é tratada como
  **provável erro de leitura da câmera** e não gera alerta.

## Os tipos de anomalia

Na lista de alertas, a coluna **Motivo principal** mostra o que mais pesou no alerta: **Permanência**,
**Frequência** ou **Horário**. No detalhe do alerta aparecem todos os motivos encontrados, cada um com uma
frase explicando o que foi visto. Um mesmo alerta pode ter mais de um motivo.

### 1. Permanência acima do normal

*(no banco de dados: `DURACAO_ACIMA`)*

**O que é:** o veículo ficou dentro do condomínio **muito mais tempo do que costuma ficar**.

**Exemplo:** um carro que sempre entra e sai em cerca de 20 minutos (por exemplo, um entregador) desta vez
ficou 5 horas lá dentro.

**Quando aparece:** no momento da **saída**, porque só aí o sistema sabe quanto tempo o veículo ficou.

**Explicações comuns que não são problema:**
- prestador de serviço fazendo um trabalho mais demorado (obra, mudança, manutenção);
- visita que dormiu no condomínio;
- a câmera não leu uma saída e uma entrada no meio do caminho, e o sistema juntou duas visitas em uma.

**O que conferir:** as fotos de entrada e saída (é o mesmo veículo?), se havia obra ou mudança autorizada para
aquela data, e se no histórico da placa aparecem saídas sem entrada perto daquele período.

### 2. Permanência abaixo do normal

*(no banco de dados: `DURACAO_ABAIXO`)*

**O que é:** o veículo ficou dentro do condomínio **muito menos tempo do que costuma ficar**.

**Exemplo:** um carro de morador que normalmente passa a noite inteira lá dentro entrou e saiu em 3 minutos.

**Detalhe importante:** este alerta só aparece para placas que já têm um histórico próprio razoável (pelo menos
10 visitas completas, com entrada e saída). Para placas pouco conhecidas o sistema não tem como saber o que é
"pouco tempo" para elas.

**Explicações comuns que não são problema:**
- o morador voltou só para buscar algo que esqueceu;
- deixou alguém na portaria e saiu;
- a câmera leu a mesma passagem duas vezes.

**O que conferir:** se as fotos mostram o mesmo veículo e o mesmo motorista de sempre, e se o trajeto faz
sentido (entrou e saiu pela mesma portaria, por exemplo).

### 3. Muitas passagens na última hora

*(no banco de dados: `FREQUENCIA_1H`)*

**O que é:** o veículo passou pela portaria (entrando ou saindo) **muitas vezes em pouco tempo**, bem mais do que
costuma passar numa hora.

**Exemplo:** um carro que costuma passar uma ou duas vezes por hora passou 7 vezes em 60 minutos.

Para evitar alarmes à toa, o sistema só considera quando a diferença é de **pelo menos 4 passagens a mais** do
que o habitual.

**Explicações comuns que não são problema:**
- vai e volta para buscar e levar pessoas ou objetos;
- a câmera leu o mesmo veículo várias vezes enquanto ele estava parado na frente dela;
- carro de manobrista, de entrega ou de aplicativo.

**O que conferir:** as fotos de cada passagem (é mesmo o carro passando várias vezes ou a câmera repetindo a
leitura?) e se o motivo das idas e vindas é conhecido.

### 4. Muitas passagens no dia

*(no banco de dados: `FREQUENCIA_24H`)*

**O que é:** o veículo passou pela portaria **muito mais vezes nas últimas 24 horas** do que costuma passar num
dia.

**Exemplo:** um morador que entra e sai, em média, 2 vezes por dia passou 10 vezes hoje.

O sistema só considera quando são **pelo menos 4 passagens a mais** do que o habitual no dia.

**Explicações comuns que não são problema:**
- dia de mudança, de festa ou de muitas tarefas fora;
- o carro foi emprestado para outra pessoa da família;
- o veículo passou a ser usado para entregas ou transporte por aplicativo.

**O que conferir:** se os horários das passagens fazem sentido em sequência (entrada, saída, entrada…) e se o
motorista nas fotos é o de sempre.

### 5. Muitas passagens na semana

*(no banco de dados: `FREQUENCIA_7D`)*

**O que é:** o veículo passou pela portaria **muito mais vezes nos últimos 7 dias** do que costuma passar numa
semana.

**Exemplo:** um carro de visitante que aparece uma ou duas vezes por semana passou 12 vezes nesta semana.

O sistema só considera quando são **pelo menos 6 passagens a mais** do que o habitual na semana.

**Explicações comuns que não são problema:**
- prestador de serviço com obra em andamento;
- parente hospedado no condomínio;
- férias ou mudança de rotina do morador (trabalhando em casa, por exemplo).

**O que conferir:** a lista de prestadores e visitantes autorizados e o histórico da placa na **Linha do Tempo**.

### 6. Horário incomum

*(no banco de dados: `HORARIO_INCOMUM`)*

**O que é:** o veículo passou pela portaria **numa hora em que quase nunca passa**.

O sistema separa **dias úteis** de **fins de semana**: um carro que só aparece de dia nos dias úteis, mas costuma
sair à noite aos sábados, não gera alerta por sair à noite num sábado.

**Exemplo:** um carro que sempre passa entre 7h e 19h nos dias úteis passou às 3h da manhã de uma terça-feira.

**Detalhe importante:** para gerar este alerta sozinho, a placa precisa ter pelo menos **20 passagens anteriores**
no mesmo tipo de dia (útil ou fim de semana). Para placas pouco conhecidas, o horário só serve para reforçar
outro motivo, nunca gera alerta sozinho.

**Explicações comuns que não são problema:**
- viagem, voo de madrugada, plantão no trabalho;
- emergência médica;
- volta de festa ou evento.

**O que conferir:** as fotos (é o mesmo veículo e o mesmo motorista de sempre?) e se houve registro ou contato
com a portaria naquele horário.

Hoje este é o motivo mais comum dos alertas, e geralmente com pontuação mais baixa. Na dúvida, um horário
incomum sozinho costuma ser só uma mudança pontual de rotina.

### 7. Mudança que vem se repetindo

*(no banco de dados: `MUDANCA_PERSISTENTE`)*

**O que é:** não é uma estranheza de um dia só. O veículo vem **fugindo do costume em vários dias diferentes**
(pelo menos 3 dias, considerando o último mês e meio), seja no tempo que fica lá dentro, seja na quantidade de
passagens.

**Exemplo:** um carro que ficava sempre 1 hora passou a ficar 6 horas, e isso aconteceu na segunda, na quarta e
na sexta.

Este motivo **sempre aparece junto com outro** (permanência ou frequência) e **aumenta a pontuação** do alerta:
uma mudança que se repete chama mais atenção que um caso isolado.

**Explicações comuns que não são problema:**
- o morador mudou de emprego ou de rotina;
- o veículo foi vendido ou passou a ser usado por outra pessoa da família;
- começou uma obra longa ou um serviço contínuo (babá, cuidador, diarista nova).

**O que conferir:** se o dono do veículo continua o mesmo, se o cadastro (morador, carro, autorizações) está
atualizado e se as fotos dos últimos dias mostram o mesmo motorista.

### Alerta sem motivo listado (sinais fracos somados)

Às vezes um alerta aparece **sem nenhum motivo listado** e com pontuação baixa (entre 30 e 40). Isso acontece
quando o veículo teve **várias pequenas estranhezas ao mesmo tempo**, cada uma fraca demais para virar motivo
sozinha, mas que somadas passaram do mínimo de alerta. Por exemplo: um horário um pouco fora do comum e um
tempo de permanência um pouco maior que o normal.

Esses alertas costumam ser de pouca importância. No detalhe do alerta dá para ver as frases de cada pequena
estranheza encontrada.

## A pontuação e a prioridade

Cada alerta recebe uma **pontuação de 0 a 100**: quanto maior, mais a passagem foge do costume do veículo.
Vários motivos juntos e mudanças que se repetem aumentam a pontuação.

| Prioridade | Pontuação | Como tratar |
|---|---|---|
| **Prioridade alta** | 80 a 100 | Olhar primeiro. A passagem foge muito do costume. |
| **Revisão** | 60 a 79 | Olhar com atenção quando possível. |
| **Observação** | 30 a 59 | Diferença leve. Geralmente é mudança de rotina. |

Abaixo de 30 o sistema não gera alerta.

## Avisos que aparecem junto do alerta

- **"histórico insuficiente":** o sistema ainda conhece pouco essa placa e comparou com **veículos de perfil
  parecido** (outros carros que usam a portaria de forma semelhante), não com o costume dela. Esses alertas são
  menos confiáveis e nunca chegam a uma pontuação muito alta só por isso.
- **"repetiu em N dia(s)":** a mesma estranheza aconteceu de novo nos dias seguintes, sem piorar. Veja a regra no
  início do guia.
- **Perfil do veículo:** ajuda a entender com quem a placa foi comparada.

| Perfil | O que quer dizer |
|---|---|
| Placa nova | nunca passou pela portaria nos últimos 90 dias |
| Esporádico | passou poucas vezes (menos de 10) |
| Recorrente | passa com frequência, mas ainda tem poucas visitas completas (entrada e saída) |
| Travessia frequente | quase sempre entra e sai rápido, em até 10 minutos (entregas, aplicativo, quem deixa alguém) |
| Permanência longa | quase sempre fica mais de 10 minutos lá dentro (moradores, prestadores) |
| Misto | às vezes fica pouco, às vezes fica muito |

## O que fazer com o alerta

Depois de olhar as fotos e o histórico, o operador marca o alerta como:

- **Relevante:** a situação merecia atenção (por exemplo, um veículo que não deveria estar lá, ou um padrão que
  precisa ser acompanhado). Marcar como relevante **não quer dizer que houve crime**, só que valeu a pena olhar.
- **Descartar:** havia uma explicação normal (visita, obra, mudança de rotina, erro de leitura da câmera).

Os alertas ainda não analisados ficam como **Aberta**. Dá para escrever uma observação curta explicando a
decisão. Isso ajuda os colegas e ajuda a equipe técnica a ajustar o sistema para gerar menos alertas
desnecessários.
