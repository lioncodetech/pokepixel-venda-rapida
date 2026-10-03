// PokePixel - venda rapida
//
// Vende pokemon pela tela "Vender Pokemon" da loja do Mark, nas raridades que voce marcar e so' ate'
// o nivel que voce escolher. Alt+D esconde o painel e Alt+F o mostra.
//
// Nada daqui fala com o servidor por fora: o que a extensao faz e' exatamente o que voce faria a
// mao — abrir a loja, escolher a aba, marcar as caixinhas e clicar em vender.
//
// Equipe, shiny e travados nao aparecem nesta tela: quem os protege e' o proprio jogo.

(() => {
  'use strict';

  const CHAVE_RARIDADES = 'lioncode:venda-rapida:raridades';
  const CHAVE_TETO = 'lioncode:venda-rapida:teto';
  const CHAVE_LOTE = 'lioncode:venda-rapida:lote';
  const CHAVE_CONFIRMA = 'lioncode:venda-rapida:confirmar';
  const CHAVE_AUTO = 'lioncode:venda-rapida:auto';
  const CHAVE_POS = 'lioncode:venda-rapida:posicao';
  const CHAVE_TAM = 'lioncode:venda-rapida:tamanho';
  const CHAVE_LISTA = 'lioncode:venda-rapida:lista';

  /** As raridades da tela de venda, na ordem em que o jogo as mostra. */
  const RARIDADES = [
    { nome: 'Fraca', classe: 'quality-weak' },
    { nome: 'Comum', classe: 'quality-common' },
    { nome: 'Incomum', classe: 'quality-uncommon' },
    { nome: 'Rara', classe: 'quality-rare' },
    { nome: 'Épica', classe: 'quality-epic' },
    { nome: 'Lendária', classe: 'quality-legendary' },
    { nome: 'Mítica', classe: 'quality-mythical' },
  ];

  // A loja premium usa as mesmas classes npc-shop, e o resumo da expedicao tambem se chama
  // `npc-shop-window` sem ser loja nenhuma. Os dois ficam de fora.
  const LOJA = '.npc-shop-window:not(.premium-shop-window):not(.expedition-window)';
  const LINHA = '.npc-shop__pokemon-row';
  const RODAPE_VENDA = '.npc-shop__sell-footer';
  const BOTAO_VENDER = '.npc-shop__sell-button';
  const SOBREPOSTO = '.pokeidle-panel-overlay';
  const TETO_PADRAO = 2;
  // 500 e' o maximo que a propria loja vende de uma vez: o lote nao passa disso porque o jogo nao deixa.
  const LOTE_PADRAO = 500;

  const ler = (chave, padrao) => {
    try {
      return JSON.parse(localStorage.getItem(chave)) ?? padrao;
    } catch {
      return padrao;
    }
  };

  const gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* modo anonimo, ou armazenamento cheio: a extensao continua, so' nao lembra. */
    }
  };

  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /** Separador de milhar: "6760" nao se le' tao rapido quanto "6.760" na hora de conferir. */
  const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR');

  const lojaAberta = () => {
    const janela = document.querySelector(LOJA);
    return janela && janela.getBoundingClientRect().width > 0 ? janela : null;
  };

  /** Espera algo aparecer dentro da loja: a lista demora a montar depois de cada clique. */
  async function aguardarDentro(janela, seletor, limite = 5000) {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
      const achado = janela.querySelector(seletor);
      if (achado && achado.getBoundingClientRect().width > 0) return achado;
      await espera(100);
    }
    return null;
  }

  /**
   * O elemento visivel cujo texto e' exatamente `rotulo`, o mais fundo que casar.
   *
   * A aba mostra "Vender Pokémon" num botao e o mesmo texto num rotulo interno; vale o de dentro, e
   * clicar nele serve igual, porque o clique sobe ate' quem escuta.
   */
  function alvoComTexto(onde, rotulo) {
    const casam = [...onde.querySelectorAll('button, a, li, div, span, p')].filter(
      (e) => (e.textContent || '').trim() === rotulo && e.getBoundingClientRect().width > 0,
    );
    return casam[casam.length - 1] ?? null;
  }

  /**
   * A caixa de confirmacao da venda, se o jogo mostrar alguma.
   *
   * Nao deu para ver uma de perto: ela so' apareceria depois de uma venda de verdade, e nenhum
   * pokemon foi vendido para descobrir. Por isso o reconhecimento e' pelo que a caixa *e'* — uma
   * janela sobreposta que nao e' a loja, fala de venda e tem botao.
   */
  function confirmacaoNaTela() {
    for (const sobre of document.querySelectorAll(SOBREPOSTO)) {
      if (sobre.querySelector(LOJA)) continue;
      const texto = (sobre.innerText || '').toLowerCase();
      if (/vend|confirm/.test(texto) && sobre.querySelector('button')) return sobre;
    }
    return null;
  }

  /**
   * Fecha os avisos que o jogo poe por cima de tudo, antes de qualquer acao.
   *
   * O resumo da expedicao, o "a cacada continuou sem voce" e o banner do Discord aparecem sozinhos
   * e ficam na frente da loja — com eles na tela o clique da extensao nao chega a lugar nenhum. A
   * loja e' poupada (mora no mesmo tipo de janela), e com uma confirmacao na tela nao se fecha
   * nada, senao cancelariamos a venda que a propria extensao acabou de pedir.
   */
  function fecharPopups() {
    if (confirmacaoNaTela()) return;
    for (const banner of document.querySelectorAll('.pokeidle-promo-banner__close')) banner.click();
    for (const sobre of document.querySelectorAll(SOBREPOSTO)) {
      if (sobre.querySelector(LOJA)) continue;
      sobre.querySelector('.pokeidle-panel__close')?.click();
    }
  }

  /** Abre a loja pelo menu do jogo. O grupo "Cidade" so' abre no hover, mas os itens existem. */
  async function abrirLoja() {
    if (lojaAberta()) return { janela: lojaAberta(), abriEu: false };
    const item = [...document.querySelectorAll('.pokeidle-top-toolbar__dropdown-btn')].find(
      (b) => (b.textContent || '').trim() === 'Loja do Mark',
    );
    if (!item) return { janela: null, abriEu: false };
    item.click();
    const fim = Date.now() + 5000;
    while (Date.now() < fim) {
      if (lojaAberta()) return { janela: lojaAberta(), abriEu: true };
      await espera(100);
    }
    return { janela: null, abriEu: true };
  }

  /** Fecha so' pelo "Fechar" do rodape, e nunca com uma confirmacao na tela. */
  function fecharLoja(janela) {
    if (confirmacaoNaTela()) return;
    const fechar = [...janela.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === 'Fechar',
    );
    if (fechar) fechar.click();
  }

  /** Poe a loja na aba de vender pokemon: ela guarda a ultima aberta, que pode ser outra. */
  async function abaDeVenda(janela) {
    if (janela.querySelector(RODAPE_VENDA)) return true;
    const aba = alvoComTexto(janela, 'Vender Pokémon');
    if (!aba) return false;
    aba.click();
    return Boolean(await aguardarDentro(janela, RODAPE_VENDA, 5000));
  }

  const botoesDeRaridade = (janela) =>
    [...janela.querySelectorAll('.npc-shop__quality')].filter(
      (b) => !b.classList.contains('quality-all'),
    );

  const raridadeDoBotao = (botao) =>
    RARIDADES.find((r) => botao.classList.contains(r.classe))?.nome ?? '';

  const ligada = (botao) =>
    botao.classList.contains('is-active') || botao.getAttribute('aria-pressed') === 'true';

  /**
   * Deixa ligados exatamente os filtros das raridades escolhidas.
   *
   * Os filtros sao alternaveis e o jogo lembra quais ficaram ligados da ultima vez. Ligar os certos
   * nao basta: e' preciso desligar os outros, senao uma raridade que voce tirou da lista continuaria
   * na tela — e seria vendida.
   */
  async function marcarRaridades(janela, escolhidas) {
    for (const botao of botoesDeRaridade(janela)) {
      if (ligada(botao) === escolhidas.includes(raridadeDoBotao(botao))) continue;
      botao.click();
      await espera(150);
    }
  }

  /**
   * Desmarca o que ja' estava marcado antes de comecarmos.
   *
   * Uma tentativa cancelada na caixa de confirmacao deixa as linhas marcadas, e o mesmo vale para o
   * que voce tiver marcado a mao. Sem limpar, essas linhas iriam junto na proxima venda sem ninguem
   * ter decidido isso — e, pior, a extensao as ignoraria na conta do que ia vender.
   */
  async function limparSelecao(janela) {
    const todos = janela.querySelector('.npc-shop__select-all input[type="checkbox"]');
    if (todos?.checked) {
      todos.click();
      await espera(200);
    }
    for (const linha of janela.querySelectorAll(LINHA)) {
      const caixa = linha.querySelector('input[type="checkbox"]');
      if (caixa?.checked) {
        caixa.click();
        await espera(60);
      }
    }
  }

  /** Le o que a linha mostra. O nivel vem do "· Nv. 37" do titulo, que usa ponto de milhar. */
  function dadosDaLinha(linha) {
    const titulo = linha.querySelector('b')?.textContent ?? '';
    const nivel = Number((/Nv\.\s*([\d.]+)/.exec(titulo)?.[1] ?? '').replace(/\./g, ''));
    const marca = linha.querySelector('.npc-shop__rarity');
    return {
      nome: titulo.split('·')[0].trim(),
      nivel: Number.isFinite(nivel) ? nivel : 0,
      raridade: RARIDADES.find((r) => marca?.classList.contains(r.classe))?.nome ?? '',
      preco: Number(
        linha
          .querySelector('.npc-shop__price .pokeidle-currency__amount')
          ?.textContent?.replace(/\D/g, '') ?? 0,
      ),
      caixa: linha.querySelector('input[type="checkbox"]'),
    };
  }

  /**
   * Reparte a venda ao longo de 5 a 20 segundos, contados de agora.
   *
   * Os marcos sao absolutos: o tempo que o jogo levar para redesenhar a lista sai da fatia seguinte
   * em vez de somar no fim, entao a duracao total e' a sorteada, e nao a sorteada mais a espera.
   */
  function ritmo(passos) {
    const inicio = Date.now();
    const total = 5000 + Math.random() * 15000;
    let passo = 0;
    return () => {
      passo += 1;
      const alvo = Math.round((total * passo) / Math.max(1, passos));
      return espera(Math.max(0, inicio + alvo - Date.now()));
    };
  }

  const escolhidas = () => ler(CHAVE_RARIDADES, []);
  const teto = () => Math.max(1, Number(ler(CHAVE_TETO, TETO_PADRAO)) || TETO_PADRAO);
  const lote = () => Math.min(500, Math.max(1, Number(ler(CHAVE_LOTE, LOTE_PADRAO)) || LOTE_PADRAO));

  /** Guarda quantos ha' de cada raridade, para o painel dizer alguma coisa com a loja fechada. */
  function anotarLista(janela) {
    const contagem = {};
    for (const linha of janela.querySelectorAll(LINHA)) {
      const { raridade } = dadosDaLinha(linha);
      if (raridade) contagem[raridade] = (contagem[raridade] ?? 0) + 1;
    }
    gravar(CHAVE_LISTA, { contagem, quando: Date.now() });
    return contagem;
  }

  let parar = false;

  /**
   * Espera a confirmacao, se houver, e diz se a venda pode seguir.
   *
   * Sem saber como e' a caixa, o caminho seguro e' este: se nada aparecer, a venda saiu no clique;
   * se aparecer, so' confirmamos quando voce deixou marcado "confirmar sozinho" — caso contrario a
   * caixa fica na tela, esperando voce.
   */
  async function confirmarVenda(quantos, avisar) {
    const fim = Date.now() + 5000;
    while (Date.now() < fim) {
      const caixa = confirmacaoNaTela();
      if (caixa) {
        if (!ler(CHAVE_CONFIRMA, false)) {
          avisar(`confirme na tela para vender ${quantos}`);
          return false;
        }
        const sim = [...caixa.querySelectorAll('button')].find((b) =>
          /^(vender|confirmar|sim|ok)$/i.test((b.textContent || '').trim()),
        );
        if (sim) {
          sim.click();
          return true;
        }
      }
      await espera(150);
    }
    return true;
  }

  /**
   * Vende, com a loja ja' aberta na aba certa.
   *
   * Escolhe sempre pela tela: marca os filtros, le as linhas que sobraram, descarta o que passa do
   * teto de nivel e corta no tamanho do lote. O teto e' conferido linha a linha mesmo com o filtro
   * de raridade ligado, porque filtro e' do jogo e teto e' nosso.
   */
  async function venderNaLoja(janela, avisar) {
    const raridades = escolhidas();
    if (!raridades.length) {
      avisar('nenhuma raridade marcada');
      return 0;
    }
    await marcarRaridades(janela, raridades);
    await espera(400);
    await limparSelecao(janela);
    anotarLista(janela);
    const alvos = [...janela.querySelectorAll(LINHA)]
      .map(dadosDaLinha)
      .filter((p) => p.caixa && !p.caixa.checked && raridades.includes(p.raridade) && p.nivel <= teto())
      .slice(0, lote());
    if (!alvos.length) {
      avisar(`nada ate o nivel ${teto()} nas raridades marcadas`);
      return 0;
    }
    const valor = alvos.reduce((soma, p) => soma + p.preco, 0);
    const pausa = ritmo(alvos.length + 1);
    for (const alvo of alvos) {
      if (parar) break;
      await pausa();
      alvo.caixa.click();
    }
    if (parar) {
      avisar('parado antes de vender');
      return 0;
    }
    avisar(`vendendo ${alvos.length} por ${moeda(valor)}...`);
    await pausa();
    const botao = janela.querySelector(BOTAO_VENDER);
    if (!botao || botao.disabled) {
      avisar('o botao de vender nao habilitou');
      return 0;
    }
    const antes = janela.querySelectorAll(LINHA).length;
    botao.click();
    if (!(await confirmarVenda(alvos.length, avisar))) return 0;
    // A prova de que vendeu e' a lista encolher: o botao sozinho nao diz se o servidor aceitou.
    const fim = Date.now() + 8000;
    while (Date.now() < fim && janela.querySelectorAll(LINHA).length === antes) await espera(200);
    const sairam = antes - janela.querySelectorAll(LINHA).length;
    if (sairam <= 0) {
      avisar('cliquei em vender, mas a lista nao mudou');
      return 0;
    }
    gravar('lioncode:venda-rapida:ultima', {
      quantos: sairam,
      valor,
      quando: Date.now(),
    });
    avisar(`vendidos ${sairam} por ${moeda(valor)}`);
    return sairam;
  }

  /** Uma venda inteira, da loja fechada ate' a loja fechada de novo. */
  async function vender(avisar) {
    parar = false;
    fecharPopups();
    avisar('abrindo a loja...');
    const { janela, abriEu } = await abrirLoja();
    if (!janela) {
      avisar('nao achei a loja do Mark');
      return 0;
    }
    if (!(await abaDeVenda(janela))) {
      avisar('nao achei a aba de vender pokemon');
      if (abriEu) fecharLoja(janela);
      return 0;
    }
    const sairam = await venderNaLoja(janela, avisar);
    if (abriEu) fecharLoja(janela);
    desenhar();
    return sairam;
  }

  /** So' le': abre a loja, conta quantos ha' de cada raridade e fecha. */
  async function atualizarLista(avisar) {
    fecharPopups();
    avisar('vendo a lista...');
    const { janela, abriEu } = await abrirLoja();
    if (!janela) {
      avisar('nao achei a loja do Mark');
      return;
    }
    if (!(await abaDeVenda(janela))) {
      avisar('nao achei a aba de vender pokemon');
      if (abriEu) fecharLoja(janela);
      return;
    }
    // "Todos" liga todas as raridades de uma vez, que e' o que esta contagem precisa ver.
    janela.querySelector('.npc-shop__quality.quality-all')?.click();
    await espera(900);
    const contagem = anotarLista(janela);
    await espera(600 + Math.random() * 1500);
    if (abriEu) fecharLoja(janela);
    const total = Object.values(contagem).reduce((soma, n) => soma + n, 0);
    avisar(total ? `${total} a venda` : 'nenhum pokemon a venda');
    desenhar();
  }

  // ---------- interface ----------

  const painel = document.createElement('div');
  painel.id = 'lioncode-venda-rapida';
  painel.innerHTML = `
    <header>
      <strong>Venda rapida</strong>
      <span data-ultima></span>
      <button type="button" data-fechar>&times;</button>
    </header>
    <div data-lista></div>
    <footer>
      <label class="linha">
        vender so ate o nivel <input type="number" data-teto min="1" max="9999">
        , no maximo <input type="number" data-lote min="1" max="500"> por vez
      </label>
      <label class="linha"><input type="checkbox" data-confirma> Confirmar sozinho</label>
      <button type="button" class="vender" data-vender>Vender agora</button>
      <div class="rodape">
        <button type="button" data-atualizar>Atualizar lista</button>
        <span data-aviso>Alt+D esconde, Alt+F mostra</span>
      </div>
      <label class="linha">
        <button type="button" class="auto-botao" data-auto>Iniciar</button>
        vender
        <select data-modo>
          <option value="minutos">a cada</option>
          <option value="horarios">uma vez entre</option>
        </select>
        <span data-campos-minutos>
          <input type="number" data-min min="1" max="1440"> a
          <input type="number" data-max min="1" max="1440"> min
        </span>
        <span class="horarios">
          <input type="text" data-horarios placeholder="08:00-09:00, 19:00-20:00"
            title="Uma janela por vírgula. Dentro de cada uma ela age uma única vez."
            spellcheck="false">
        </span>
        <span data-proxima></span>
      </label>
    </footer>`;

  const estilo = document.createElement('style');
  estilo.textContent = `
    #lioncode-venda-rapida, #lioncode-venda-rapida * { box-sizing: border-box; }
    #lioncode-venda-rapida {
      position: fixed; z-index: 2147483000; width: 420px; max-height: 88vh; overflow: auto;
      resize: both; min-width: 320px; min-height: 150px;
      background: #10151e; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 12px;
      font: 12px/1.45 system-ui, sans-serif; box-shadow: 0 14px 34px rgba(0,0,0,.55);
      scrollbar-width: thin; scrollbar-color: #2a3240 transparent;
      /* Transparente em repouso para nao tapar o jogo atras dela, e opaca assim que o mouse ou o
         teclado chega: o painel e' para ser lido de perto, nao enquanto se joga. */
      opacity: .82; transition: opacity .15s;
    }
    #lioncode-venda-rapida:hover, #lioncode-venda-rapida:focus-within { opacity: 1; }
    #lioncode-venda-rapida header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 12px; background: linear-gradient(#1b2430, #161d27); cursor: move;
      border-bottom: 1px solid #222a36;
    }
    #lioncode-venda-rapida header strong { font-size: 13px; }
    #lioncode-venda-rapida [data-ultima] { color: #8b93a5; font-size: 11px; text-align: right; }
    #lioncode-venda-rapida [data-fechar] {
      background: none; border: 0; color: #8b93a5; font-size: 17px; cursor: pointer; line-height: 1;
    }
    #lioncode-venda-rapida [data-lista] { padding: 6px 12px 2px; }
    #lioncode-venda-rapida .raridade {
      display: flex; align-items: center; gap: 8px; padding: 4px 0;
      border-bottom: 1px solid #1a212c;
    }
    #lioncode-venda-rapida .raridade span { flex: 1; }
    #lioncode-venda-rapida .raridade em {
      font-style: normal; color: #7d8697; font-size: 11px;
    }
    #lioncode-venda-rapida footer { padding: 8px 12px 12px; }
    #lioncode-venda-rapida footer .linha {
      display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
      margin: 6px 0 0; color: #9aa3b4;
    }
    #lioncode-venda-rapida footer input[type="number"] {
      width: 58px; padding: 2px 4px; background: #0b0f16; color: #e6e9ef;
      border: 1px solid #2a3240; border-radius: 6px; font: inherit;
    }
    #lioncode-venda-rapida .horarios { display: inline-flex; align-items: center; gap: 5px; }
    #lioncode-venda-rapida .horarios input {
      width: 150px; padding: 2px 5px; background: #0b0f16; color: #e6e9ef;
      border: 1px solid #2a3240; border-radius: 6px; font: inherit;
    }
    /* Texto que nao vira janela nenhuma: o ciclo ficaria parado sem explicacao. */
    #lioncode-venda-rapida [data-proxima] { color: #7d8697; font-size: 11px; }
    #lioncode-venda-rapida [data-modo] {
      background: #0b0f16; color: #e6e9ef; border: 1px solid #2a3240; border-radius: 6px;
      font: inherit; padding: 2px 4px;
    }
    #lioncode-venda-rapida .horarios input.erro { border-color: #7a3b3b; color: #f0b7b7; }
    #lioncode-venda-rapida .vender {
      display: block; width: 100%; margin: 9px 0 7px; padding: 7px; font: inherit;
      font-weight: 600; cursor: pointer; border-radius: 8px; border: 1px solid #5e3a3a;
      background: #33201f; color: #f0cfcf;
    }
    #lioncode-venda-rapida .vender:hover:not(:disabled) { background: #432927; }
    #lioncode-venda-rapida .vender:disabled { opacity: .45; cursor: default; }
    #lioncode-venda-rapida .vender.parando { border-color: #5e3a3a; }
    #lioncode-venda-rapida .rodape { display: flex; align-items: center; gap: 8px; }
    #lioncode-venda-rapida .rodape button, #lioncode-venda-rapida .auto-botao {
      flex: none; background: #1a2230; color: #c3c9d6; border: 1px solid #2a3240;
      border-radius: 7px; padding: 3px 9px; font: inherit; cursor: pointer;
    }
    #lioncode-venda-rapida .auto-botao { min-width: 104px; font-weight: 600; }
    #lioncode-venda-rapida .auto-botao.parando {
      border-color: #5e3a3a; background: #33201f; color: #f0cfcf;
    }
    #lioncode-venda-rapida .rodape button:disabled { opacity: .45; cursor: default; }
    #lioncode-venda-rapida [data-aviso] {
      flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: #8b93a5;
    }`;

  let emVenda = false;

  const aviso = () => painel.querySelector('[data-aviso]');
  let apagarAviso = 0;
  function mostrar(texto) {
    aviso().textContent = texto;
    clearTimeout(apagarAviso);
    apagarAviso = setTimeout(() => {
      aviso().textContent = 'Alt+D esconde, Alt+F mostra';
    }, 12000);
  }

  const idade = (quando) => {
    const minutos = Math.round((Date.now() - quando) / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `ha ${minutos} min`;
    return `ha ${Math.round(minutos / 60)} h`;
  };

  function desenhar() {
    const marcadas = escolhidas();
    const lista = ler(CHAVE_LISTA, { contagem: {}, quando: 0 });
    const alvo = painel.querySelector('[data-lista]');
    alvo.textContent = '';
    for (const raridade of RARIDADES) {
      const bloco = document.createElement('label');
      bloco.className = 'raridade';
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = marcadas.includes(raridade.nome);
      const nome = document.createElement('span');
      nome.textContent = raridade.nome;
      const quantos = document.createElement('em');
      const visto = lista.contagem?.[raridade.nome];
      quantos.textContent = visto === undefined ? '—' : `${moeda(visto)} a venda`;
      quantos.title = lista.quando ? `Lista vista ${idade(lista.quando)}.` : 'Lista nunca lida.';
      caixa.addEventListener('change', () => {
        const atual = new Set(escolhidas());
        if (caixa.checked) atual.add(raridade.nome);
        else atual.delete(raridade.nome);
        gravar(CHAVE_RARIDADES, [...atual]);
      });
      bloco.append(caixa, nome, quantos);
      alvo.append(bloco);
    }
    const ultima = ler('lioncode:venda-rapida:ultima', null);
    painel.querySelector('[data-ultima]').textContent = ultima
      ? `${ultima.quantos} por ${moeda(ultima.valor)} ${idade(ultima.quando)}`
      : '';
  }

  // Arrastar pelo cabecalho, com a posicao lembrada.
  function arrastavel() {
    const cabecalho = painel.querySelector('header');
    let partida = null;
    cabecalho.addEventListener('pointerdown', (evento) => {
      if (evento.target.closest('button')) return;
      // `...getBoundingClientRect()` devolve objeto vazio: as medidas vivem no prototipo.
      const caixa = painel.getBoundingClientRect();
      partida = { x: evento.clientX, y: evento.clientY, left: caixa.left, top: caixa.top };
      cabecalho.setPointerCapture(evento.pointerId);
    });
    cabecalho.addEventListener('pointermove', (evento) => {
      if (!partida) return;
      const x = Math.max(0, Math.min(innerWidth - 60, partida.left + evento.clientX - partida.x));
      const y = Math.max(0, Math.min(innerHeight - 30, partida.top + evento.clientY - partida.y));
      painel.style.left = `${x}px`;
      painel.style.top = `${y}px`;
      painel.style.right = 'auto';
    });
    const soltar = () => {
      if (!partida) return;
      partida = null;
      gravar(CHAVE_POS, { left: painel.style.left, top: painel.style.top });
    };
    cabecalho.addEventListener('pointerup', soltar);
    cabecalho.addEventListener('pointercancel', soltar);
  }

  /**
   * Tamanho proporcional a janela, nao fixo em pixels.
   *
   * O painel vive dentro de uma janela do LionMultInstance, que muda de tamanho quando as janelas
   * sao rearranjadas. Guardar pixels faria o painel transbordar num quadrante; guardar a escolha
   * junto com a janela onde foi feita deixa refaze-la em qualquer tamanho.
   */
  const LARGURA_PADRAO = 420;
  let ultimoAjuste = 0;

  function ajustarAoViewport() {
    const tam = ler(CHAVE_TAM, null);
    const minL = Math.min(320, innerWidth - 8);
    const minA = Math.min(150, innerHeight - 8);
    painel.style.minWidth = `${minL}px`;
    painel.style.minHeight = `${minA}px`;
    const alvoL = tam?.largura
      ? (tam.largura / (tam.janelaLargura || innerWidth)) * innerWidth
      : LARGURA_PADRAO;
    painel.style.width = `${Math.max(minL, Math.min(innerWidth - 8, Math.round(alvoL)))}px`;
    if (tam?.altura) {
      const alvoA = (tam.altura / (tam.janelaAltura || innerHeight)) * innerHeight;
      painel.style.height = `${Math.max(minA, Math.min(innerHeight - 8, Math.round(alvoA)))}px`;
      painel.style.maxHeight = 'none';
    }
    if (painel.style.left) {
      const caixa = painel.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - caixa.width, parseFloat(painel.style.left) || 0));
      const fundo = Math.max(0, innerHeight - caixa.height);
      const y = Math.max(0, Math.min(fundo, parseFloat(painel.style.top) || 0));
      painel.style.left = `${x}px`;
      painel.style.top = `${y}px`;
    }
    ultimoAjuste = Date.now();
  }

  const posicao = ler(CHAVE_POS, null);
  if (posicao?.left) {
    painel.style.left = posicao.left;
    painel.style.top = posicao.top;
  } else {
    painel.style.right = '16px';
    painel.style.top = '150px';
  }

  document.documentElement.append(estilo, painel);
  ajustarAoViewport();
  arrastavel();

  let gravarTamanho = 0;
  new ResizeObserver(() => {
    clearTimeout(gravarTamanho);
    gravarTamanho = setTimeout(() => {
      if (painel.style.display === 'none') return;
      // Um ajuste nosso tambem acorda o observador; gravar ai' trocaria a escolha da pessoa pelo
      // tamanho encolhido de um quadrante.
      if (Date.now() - ultimoAjuste < 700) return;
      painel.style.maxHeight = 'none';
      const caixa = painel.getBoundingClientRect();
      gravar(CHAVE_TAM, {
        largura: Math.round(caixa.width),
        altura: Math.round(caixa.height),
        janelaLargura: innerWidth,
        janelaAltura: innerHeight,
      });
    }, 400);
  }).observe(painel);

  let ajusteJanela = 0;
  addEventListener('resize', () => {
    clearTimeout(ajusteJanela);
    ajusteJanela = setTimeout(ajustarAoViewport, 150);
  });

  const botaoVender = painel.querySelector('[data-vender]');
  const botaoLista = painel.querySelector('[data-atualizar]');

  /** Enquanto uma venda corre, nada mais comeca outra; so' o "Parar" continua vivo. */
  function ocupado(estado) {
    emVenda = estado;
    botaoLista.disabled = estado;
    botaoVender.textContent = estado ? 'Parar' : 'Vender agora';
    botaoVender.classList.toggle('parando', estado);
  }

  /** Uma passagem pela lista. O botao e o relogio entram pela mesma porta. */
  async function rodarVenda() {
    ocupado(true);
    try {
      await vender(mostrar);
    } finally {
      parar = false;
      ocupado(false);
    }
  }

  botaoVender.addEventListener('click', () => {
    if (emVenda) {
      parar = true;
      botaoVender.disabled = true;
      setTimeout(() => {
        botaoVender.disabled = false;
      }, 1500);
      return;
    }
    void rodarVenda();
  });

  botaoLista.addEventListener('click', () => {
    botaoLista.disabled = true;
    void atualizarLista(mostrar).finally(() => {
      botaoLista.disabled = false;
    });
  });

  const campoTeto = painel.querySelector('[data-teto]');
  const campoLote = painel.querySelector('[data-lote]');
  campoTeto.value = teto();
  campoLote.value = lote();
  campoTeto.addEventListener('change', () => {
    gravar(CHAVE_TETO, Math.max(1, Math.min(9999, Number(campoTeto.value) || TETO_PADRAO)));
    campoTeto.value = teto();
  });
  campoLote.addEventListener('change', () => {
    gravar(CHAVE_LOTE, Math.max(1, Math.min(500, Number(campoLote.value) || LOTE_PADRAO)));
    campoLote.value = lote();
  });

  const confirma = painel.querySelector('[data-confirma]');
  // Desmarcado por padrao: vender nao tem desfazer, entao a primeira confirmacao e' sua.
  confirma.checked = ler(CHAVE_CONFIRMA, false);
  confirma.addEventListener('change', () => gravar(CHAVE_CONFIRMA, confirma.checked));

  // Venda sozinha: desligada por padrao, e sempre pelo mesmo caminho do botao "Vender agora".
  const auto = painel.querySelector('[data-auto]');
  const campoMin = painel.querySelector('[data-min]');
  const campoMax = painel.querySelector('[data-max]');
  const campoHorarios = painel.querySelector('[data-horarios]');
  const campoModo = painel.querySelector('[data-modo]');
  const camposMinutos = painel.querySelector('[data-campos-minutos]');
  const campoProxima = painel.querySelector('[data-proxima]');
  let relogio = 0;
  let proxima = 0;

  function configAuto() {
    const salvo = ler(CHAVE_AUTO, null) ?? {};
    const minimo = Number(salvo.min) || 60;
    const maximo = Number(salvo.max) || minimo;
    return {
      ligado: salvo.ligado === true,
      min: minimo,
      max: Math.max(minimo, maximo),
      horarios: String(salvo.horarios ?? ''),
      modo: salvo.modo === 'horarios' ? 'horarios' : 'minutos',
      ultima: Number(salvo.ultima) || 0,
    };
  }

  /**
   * As janelas de horario em que o ciclo pode agir, lidas de "08:00-09:00, 18:00-20:00".
   *
   * Vazio quer dizer "a qualquer hora", que e' o modo de so' minutagem — o unico que existia antes.
   * Uma janela que termina antes de comecar atravessa a meia-noite: 22:00-02:00 vale assim.
   */
  function janelas() {
    const achadas = [];
    for (const parte of String(configAuto().horarios).split(/[;,]/)) {
      const casa =
        /^\s*(\d{1,2})(?::(\d{2}))?\s*h?\s*(?:-|as|ate|até)\s*(\d{1,2})(?::(\d{2}))?\s*h?\s*$/i.exec(
          parte,
        );
      if (!casa) continue;
      const minuto = (hora, min) => (Number(hora) % 24) * 60 + (Number(min ?? 0) % 60);
      achadas.push({ inicio: minuto(casa[1], casa[2]), fim: minuto(casa[3], casa[4]) });
    }
    return achadas;
  }

  /**
   * As janelas como instantes de verdade, de ontem, hoje e amanha, em ordem de abertura.
   *
   * Em minutos do dia nao da' para dizer "esta janela ja' foi usada": 08:00 de hoje e 08:00 de
   * amanha sao o mesmo numero. Com instantes absolutos, cada abertura e' unica e pode ser
   * comparada com a hora da ultima rodada. Ontem entra na conta por causa das janelas que
   * atravessam a meia-noite.
   */
  function proximasJanelas(agora) {
    const todas = [];
    for (const { inicio, fim } of janelas()) {
      const duracao = ((fim - inicio + 1440) % 1440 || 1440) * 60000;
      for (const dia of [-1, 0, 1]) {
        const abre = new Date(agora);
        abre.setHours(0, 0, 0, 0);
        abre.setDate(abre.getDate() + dia);
        abre.setMinutes(inicio);
        todas.push({ abre: abre.getTime(), fecha: abre.getTime() + duracao });
      }
    }
    return todas.sort((a, b) => a.abre - b.abre);
  }

  /**
   * Quanto falta, em ms, ate' o instante sorteado da proxima janela — ou `null` se nao ha' janela.
   *
   * Uma rodada por janela: a que ja' recebeu a sua fica para tras pela comparacao com `ultima`.
   * O instante e' sorteado dentro da janela inteira, e nao na abertura, porque agir sempre as
   * 08:00 em ponto e' o padrao mais visivel que existe. Com a janela ja' aberta, o sorteio vale do
   * momento atual ate' o fechamento.
   */
  function esperaDaJanela(agora = new Date()) {
    const quando = agora.getTime();
    const ultima = configAuto().ultima;
    for (const { abre, fecha } of proximasJanelas(agora)) {
      if (fecha <= quando || abre <= ultima) continue;
      const comeco = Math.max(abre, quando);
      if (comeco >= fecha) continue;
      return comeco - quando + Math.random() * (fecha - comeco);
    }
    return null;
  }

  /** Mostra so' os campos do modo escolhido: dois conjuntos a' vista e' o que confundia. */
  function atualizarModo() {
    const porHorario = campoModo.value === 'horarios';
    camposMinutos.style.display = porHorario ? 'none' : '';
    campoHorarios.parentElement.style.display = porHorario ? '' : 'none';
  }

  /** Cada ciclo sorteia o seu proprio tempo: um intervalo fixo e' o padrao mais obvio que existe. */
  function minutosSorteados() {
    const { min, max } = configAuto();
    return Math.max(1, min + Math.random() * (max - min));
  }

  /** O rotulo do botao e' o relogio: ligado, ele diz quanto falta para a proxima venda. */
  function desenharAuto() {
    const ligado = configAuto().ligado;
    auto.classList.toggle('parando', ligado);
    if (!ligado) {
      auto.textContent = 'Iniciar';
      campoProxima.textContent = '';
      return;
    }
    if (!proxima) {
      auto.textContent = 'Parar · agora';
      campoProxima.textContent = 'em andamento';
      return;
    }
    const falta = Math.max(0, proxima - Date.now());
    const dois = (n) => String(n).padStart(2, '0');
    // A contagem sozinha nao responde "quando e' que isso acontece?". A hora por extenso responde,
    // e e' ela que mostra, no modo horario, que a rodada vai cair dentro da janela.
    const quando = new Date(proxima);
    campoProxima.textContent = `próxima às ${dois(quando.getHours())}:${dois(quando.getMinutes())}`;
    const horas = Math.floor(falta / 3600000);
    const mm = Math.floor((falta % 3600000) / 60000);
    const ss = Math.floor((falta % 60000) / 1000);
    // Com janelas de horario a espera passa facil de uma hora, e "115:14" nao se le' como tempo.
    auto.textContent = horas
      ? `Parar · ${horas}:${dois(mm)}:${dois(ss)}`
      : `Parar · ${dois(mm)}:${dois(ss)}`;
  }

  function agendarVenda() {
    clearTimeout(relogio);
    // Os dois modos se separam aqui, e so' aqui: por minutagem o intervalo e' sorteado na faixa;
    // por horario e' sorteado dentro da proxima janela que ainda nao teve a sua rodada.
    const ms =
      configAuto().modo === 'horarios' ? esperaDaJanela() : minutosSorteados() * 60000;
    if (ms === null) {
      // Modo horario sem nenhuma janela legivel: nao da' para marcar nada, e dizer isso e' melhor
      // do que um ciclo ligado que nunca acontece.
      proxima = 0;
      desenharAuto();
      campoProxima.textContent = 'nenhum horário válido';
      return;
    }
    proxima = Date.now() + ms;
    relogio = setTimeout(() => void rodadaAuto(), ms);
    desenharAuto();
  }

  /**
   * Uma rodada do relogio.
   *
   * A proxima e' marcada no fim, e nao junto com a largada, para duas vendas nunca se cruzarem: uma
   * rodada que demore mais do que o intervalo empurra a seguinte em vez de disputar a loja.
   */
  async function rodadaAuto() {
    clearTimeout(relogio);
    proxima = 0;
    desenharAuto();
    // A janela fica marcada como usada antes de agir: se a rodada demorar e terminar ja' fora
    // dela, ainda assim foi a rodada daquela janela, e a proxima tem de ser a seguinte.
    gravar(CHAVE_AUTO, { ...ler(CHAVE_AUTO, {}), ultima: Date.now() });
    // Uma venda pedida a mao tem a vez: esta rodada cede e volta no proximo intervalo.
    if (!emVenda) await rodarVenda();
    if (configAuto().ligado) agendarVenda();
  }

  const salvarAuto = (ligado) => {
    const limite = (campo, padrao) => Math.min(1440, Math.max(1, Number(campo.value) || padrao));
    const minimo = limite(campoMin, 60);
    const maximo = Math.max(minimo, limite(campoMax, minimo));
    campoMin.value = minimo;
    campoMax.value = maximo;
    const horarios = campoHorarios.value.trim();
    gravar(CHAVE_AUTO, {
      ...ler(CHAVE_AUTO, {}),
      ligado,
      min: minimo,
      max: maximo,
      horarios,
      modo: campoModo.value,
    });
    atualizarModo();
    // Texto que nao vira janela nenhuma fica marcado: aceitar em silencio faria o ciclo
    // ficar parado para sempre sem ninguem entender por que.
    campoHorarios.classList.toggle('erro', Boolean(horarios) && !janelas().length);
  };

  auto.addEventListener('click', () => {
    const ligar = !configAuto().ligado;
    salvarAuto(ligar);
    if (ligar) {
      // Por minutagem, comecar e' vender: a primeira rodada sai agora. Por horario nao — a graca do
      // modo e' a rodada cair dentro da janela, entao aqui so' se marca a proxima.
      if (configAuto().modo === 'horarios') agendarVenda();
      else void rodadaAuto();
      return;
    }
    clearTimeout(relogio);
    proxima = 0;
    if (emVenda) parar = true;
    desenharAuto();
  });

  const mudouFaixa = () => {
    salvarAuto(configAuto().ligado);
    if (configAuto().ligado && proxima) agendarVenda();
  };
  campoModo.addEventListener('change', mudouFaixa);
  campoHorarios.addEventListener('change', mudouFaixa);
  campoMin.addEventListener('change', mudouFaixa);
  campoMax.addEventListener('change', mudouFaixa);

  campoModo.value = configAuto().modo;
  atualizarModo();
  campoHorarios.value = configAuto().horarios;
  campoMin.value = configAuto().min;
  campoMax.value = configAuto().max;
  // Recarregar a pagina nao e' pedir uma venda: o ciclo ligado volta a contar o tempo, mas a
  // primeira rodada espera o intervalo em vez de vender no ato de abrir o jogo.
  if (configAuto().ligado) agendarVenda();
  else desenharAuto();
  setInterval(desenharAuto, 1000);

  painel.querySelector('[data-fechar]').addEventListener('click', () => {
    painel.style.display = 'none';
  });

  /**
   * Dois atalhos, nao um alterna.
   *
   * Com um unico atalho nunca se sabe em que estado o painel esta' sem olhar — e quem aperta duas
   * vezes volta ao comeco. Alt+D esconde, Alt+F mostra, e apertar o mesmo de novo nao desfaz nada.
   */
  addEventListener('keydown', (evento) => {
    if (!evento.altKey) return;
    const tecla = evento.key.toLowerCase();
    if (tecla !== 'd' && tecla !== 'f') return;
    // O Chrome usa Alt+D para a barra de endereco e Alt+F para o menu; dentro do LionMultInstance
    // nao ha' nem um nem outro. Pedir para o navegador nao agir e' o que da' para fazer daqui.
    evento.preventDefault();
    painel.style.display = tecla === 'd' ? 'none' : '';
  });

  desenhar();
})();
