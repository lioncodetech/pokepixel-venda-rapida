# PokePixel — venda rápida

Vende Pokémon pela tela **Vender Pokémon** da loja do Mark, nas raridades que você marcar e só até
o nível que você escolher. **Alt+D** esconde o painel e **Alt+F** o traz de volta.

## O que ela vende

Você marca as raridades — Fraca, Comum, Incomum, Rara, Épica, Lendária, Mítica — e dois limites:

- **o nível máximo**: nada acima dele é vendido, mesmo que a raridade esteja marcada;
- **quantos por vez**: o tamanho do lote, para um engano na configuração não esvaziar a coleção de
  uma vez só.

O nível é conferido linha a linha, e não só pelo filtro da loja: filtro é do jogo, teto é nosso.

**Equipe, shiny e travados não aparecem nesta tela** — quem protege esses é o próprio jogo, e a
extensão não tem como vendê-los nem por engano.

## Como ela vende

Exatamente como você venderia. Fecha os avisos que o jogo põe por cima (resumo da expedição, "a
caçada continuou sem você", banner do Discord), abre a loja do Mark pelo menu, vai até **Vender
Pokémon**, deixa ligados exatamente os filtros das raridades marcadas — ligando os seus e
**desligando os outros**, senão uma raridade que você tirou da lista continuaria na tela —, marca
as caixinhas e clica em vender.

Antes de marcar qualquer coisa ela **limpa a seleção que estiver na tela**. Uma tentativa cancelada
na confirmação deixa linhas marcadas, e elas iriam junto na venda seguinte sem ninguém ter decidido
isso.

Os passos são espalhados por um tempo sorteado entre 5 e 20 segundos, contados de quando a loja
abre. **Nenhuma requisição é montada por fora do jogo.**

## A confirmação

Se o jogo pedir confirmação, a extensão só confirma sozinha quando você marca **Confirmar sozinho**
— que vem **desmarcado**, porque vender não tem desfazer. Sem isso, ela deixa a caixa na tela e
avisa quantos estão esperando o seu clique.

A prova de que a venda saiu é a lista encolher. Se a lista não mudar, ela diz isso em vez de
afirmar que vendeu.

## Vender sozinho

O botão **Iniciar**, no rodapé, liga o ciclo: vende na hora e marca a próxima venda para daqui a um
tempo sorteado dentro da faixa de minutos. O botão vira **Parar** e mostra o relógio da próxima.
A próxima só é marcada quando a anterior termina, então duas vendas nunca se cruzam. Recarregar a
página não dispara venda: o ciclo volta a contar o tempo, mas espera o intervalo.

### Os dois modos do ciclo

A lista ao lado do botão escolhe como o ciclo marca a próxima rodada:

- **a cada** `10` a `15` **min** — o que já existia: um intervalo sorteado dentro da faixa, a
  qualquer hora do dia.
- **uma vez entre** `08:00-09:00, 19:00-20:00` — **uma única rodada dentro de cada janela**, num
  instante sorteado lá dentro. Com essas duas janelas são duas rodadas por dia: uma entre 8 e 9,
  outra entre 19 e 20, nunca no mesmo minuto dois dias seguidos.

Só os campos do modo escolhido aparecem. Vale uma janela, duas ou quantas quiser, separadas por
vírgula; `8-9` também serve, e uma janela que termina antes de começar atravessa a meia-noite
(`22:00-02:00`). Um texto que não vira janela nenhuma fica marcado em vermelho.

No modo por horário, apertar **Iniciar** não dispara nada na hora: ele marca a rodada da janela
atual (se ainda der tempo) ou da próxima — a graça do modo é a rodada cair dentro da janela.
Enquanto o ciclo está ligado, ao lado do relógio aparece **a hora da próxima rodada**, por exemplo
`próxima às 17:29`.

## Atualizar lista

Abre a loja só para contar quantos Pokémon há de cada raridade, e fecha. O número fica ao lado de
cada raridade no painel, com a hora da leitura.

## O que ela guarda

Tudo no armazenamento da própria página, no seu computador: as raridades marcadas, o teto de nível,
o tamanho do lote, a posição e o tamanho do painel, a última contagem vista, a última venda e as
suas preferências de confirmação e de ciclo. Não faz chamada de rede nenhuma e não envia nada para
lugar nenhum.

## Transparência

O painel fica um pouco transparente em repouso, para não tapar o jogo atrás dele, e volta ao normal
assim que o mouse ou o cursor de texto chega perto.

## Onde funciona

`pokepixel.nietore.com` e `poke.idleworld.online`. Em qualquer outro site ela não é carregada.

## Antes de usar

Isto automatiza uma ação do jogo, e uma ação **sem desfazer**. **Se o PokePixel proibir automação,
usar esta extensão é por sua conta e risco.**

Ela também é detectável, caso o jogo resolva procurar: o painel é um elemento acrescentado à
página, com um id próprio, e os cliques que ela dá chegam marcados como não confiáveis
(`isTrusted: false`), ao contrário dos seus. Não há como esconder nenhuma das duas coisas de dentro
de uma extensão que desenha na tela.
