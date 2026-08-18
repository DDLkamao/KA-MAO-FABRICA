/* ===========================================================
   MATRIZ DE CADASTRO - KA-MÃO
   Guarda os clientes no localStorage do navegador/Acode.
   Cada cliente pode gerar um arquivo HTML pronto para colar
   no GitHub Pages (link de acompanhamento do pedido).
=========================================================== */

const STORAGE_KEY = "kamao_clientes";
const PIX_STORAGE_KEY = "kamao_pix_chave";
const LINK_BASE_STORAGE_KEY = "kamao_link_base";

let clientes = carregarClientes();
let imagensAtuais = [];       // caminhos "galeria/nome.jpg" do cliente em edição
let editandoId = null;        // guarda o ID original quando estamos editando

// ---------- Elementos ----------
const form = document.getElementById("form-cliente");
const tituloForm = document.getElementById("titulo-form");
const inputId = document.getElementById("c-id");
const inputNome = document.getElementById("c-nome");
const inputContato = document.getElementById("c-contato");
const inputEndereco = document.getElementById("c-endereco");
const inputServico = document.getElementById("c-servico");
const selectGaleria = document.getElementById("c-galeria-select");
const btnAddImagem = document.getElementById("btn-add-imagem");
const previewImagens = document.getElementById("imagens-preview");
const inputValor = document.getElementById("c-valor");
const selectCondicoes = document.getElementById("c-condicoes");
const parcelasContainer = document.getElementById("parcelas-container");
const btnAddParcela = document.getElementById("btn-add-parcela");
const btnNovo = document.getElementById("btn-novo");
const listaClientesEl = document.getElementById("lista-clientes");
const resumoEntradaEl = document.getElementById("resumo-entrada");
const resumoPagoEl = document.getElementById("resumo-pago");
const resumoSaldoEl = document.getElementById("resumo-saldo");
const saidaWrap = document.getElementById("saida-wrap");
const saidaDados = document.getElementById("saida-dados");
const nomeClienteSaida = document.getElementById("nome-cliente-saida");
const linkPronto = document.getElementById("link-pronto");
const btnCopiarLink = document.getElementById("btn-copiar-link");
const btnCopiarDados = document.getElementById("btn-copiar-dados");
const toast = document.getElementById("toast");
const inputPix = document.getElementById("c-pix");
const btnSalvarPix = document.getElementById("btn-salvar-pix");
const inputLinkBase = document.getElementById("c-link-base");
const btnSalvarLink = document.getElementById("btn-salvar-link");

// ---------- Utilidades ----------
function carregarClientes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function salvarClientes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
}

function slugify(txt) {
  return txt
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mostrarToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function formatarMoeda(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarDataBR(isoDate) {
  if (!isoDate) return "";
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

// Quanto já foi pago desse cliente: soma das parcelas com status "pago".
// Se for "Pago à vista" e não houver parcela nenhuma cadastrada, considera o valor total como pago.
function calcularTotalPago(cliente) {
  const parcelas = cliente.parcelas || [];
  const somaParcelasPagas = parcelas.reduce(
    (acc, p) => (p.status === "pago" ? acc + Number(p.valor) : acc),
    0
  );
  if (cliente.condicoes === "Pago à vista" && parcelas.length === 0) {
    return Number(cliente.valor) || 0;
  }
  return somaParcelasPagas;
}

// ---------- Máscara de moeda (R$ 0,00) ----------
function valorParaTextoMoeda(num) {
  return "R$ " + formatarMoeda(num);
}

function textoMoedaParaValor(texto) {
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

function aplicarMascaraMoeda(inputEl) {
  inputEl.addEventListener("input", () => {
    let digitos = inputEl.value.replace(/\D/g, "");
    if (!digitos) digitos = "0";
    const numero = parseInt(digitos, 10) / 100;
    inputEl.value = valorParaTextoMoeda(numero);
  });
}

aplicarMascaraMoeda(inputValor);

// ---------- Parcelas dinâmicas ----------
function criarLinhaParcela(valor = "", data = "", status = "pago") {
  const row = document.createElement("div");
  row.className = "parcela-row";
  row.innerHTML = `
    <div class="parcela-linha-a">
      <input type="text" inputmode="decimal" placeholder="R$ 0,00" class="parcela-valor" value="${valor ? valorParaTextoMoeda(valor) : ""}">
      <button type="button" class="rm-parcela" title="Remover">✕</button>
    </div>
    <label class="mini-label">Data</label>
    <input type="date" class="parcela-data" value="${data}">
    <label class="mini-label">Status</label>
    <select class="parcela-status">
      <option value="pago" ${status === "pago" ? "selected" : ""}>Pago</option>
      <option value="aguardando" ${status === "aguardando" ? "selected" : ""}>Aguardando</option>
    </select>
  `;
  row.querySelector(".rm-parcela").addEventListener("click", () => row.remove());
  aplicarMascaraMoeda(row.querySelector(".parcela-valor"));
  parcelasContainer.appendChild(row);
}

btnAddParcela.addEventListener("click", () => criarLinhaParcela());

function lerParcelas() {
  const linhas = parcelasContainer.querySelectorAll(".parcela-row");
  const parcelas = [];
  linhas.forEach((linha) => {
    const valor = textoMoedaParaValor(linha.querySelector(".parcela-valor").value);
    const data = linha.querySelector(".parcela-data").value;
    const status = linha.querySelector(".parcela-status").value;
    if (valor) parcelas.push({ valor, data, status });
  });
  return parcelas;
}

// ---------- Galeria de imagens ----------
function popularSelectGaleria() {
  selectGaleria.innerHTML = "";
  const lista = typeof GALERIA_IMAGENS !== "undefined" ? GALERIA_IMAGENS : [];
  if (lista.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Nenhuma imagem em galeria.js";
    selectGaleria.appendChild(opt);
    return;
  }
  lista.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    selectGaleria.appendChild(opt);
  });
}

btnAddImagem.addEventListener("click", () => {
  const nome = selectGaleria.value;
  if (!nome) return;
  const caminho = "galeria/" + nome;
  if (imagensAtuais.includes(caminho)) {
    mostrarToast("Essa imagem já foi adicionada");
    return;
  }
  imagensAtuais.push(caminho);
  renderPreviewImagens();
});

function renderPreviewImagens() {
  previewImagens.innerHTML = "";
  imagensAtuais.forEach((caminho, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "del-img";
    wrap.innerHTML = `<img src="${caminho}"><button type="button">✕</button>`;
    wrap.querySelector("button").addEventListener("click", () => {
      imagensAtuais.splice(idx, 1);
      renderPreviewImagens();
    });
    previewImagens.appendChild(wrap);
  });
}

// ---------- Chave Pix ----------
inputPix.value = localStorage.getItem(PIX_STORAGE_KEY) || "";
btnSalvarPix.addEventListener("click", () => {
  localStorage.setItem(PIX_STORAGE_KEY, inputPix.value.trim());
  mostrarToast("Chave Pix salva!");
});

// ---------- Link base do GitHub Pages ----------
const LINK_BASE_PADRAO = "https://ddlkamao.github.io/KA-MAO-FABRICA/";
const linkBaseSalvo = localStorage.getItem(LINK_BASE_STORAGE_KEY);
inputLinkBase.value = linkBaseSalvo || LINK_BASE_PADRAO;
if (!linkBaseSalvo) localStorage.setItem(LINK_BASE_STORAGE_KEY, LINK_BASE_PADRAO);
btnSalvarLink.addEventListener("click", () => {
  let link = inputLinkBase.value.trim();
  if (link && !link.endsWith("/")) link += "/";
  inputLinkBase.value = link;
  localStorage.setItem(LINK_BASE_STORAGE_KEY, link);
  mostrarToast("Link do GitHub Pages salvo!");
});

// ---------- Salvar / Editar cliente ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = slugify(inputId.value);
  if (!id) {
    mostrarToast("Preencha o ID do cliente");
    return;
  }
console.log("ID recebido:", id);
console.log("Lista de clientes:", lista);
console.log("Quantidade de clientes:", lista.length);
  const cliente = {
    id,
    nome: inputNome.value.trim(),
    contato: inputContato.value.trim(),
    endereco: inputEndereco.value.trim(),
    servico: inputServico.value.trim(),
    imagens: imagensAtuais,
    valor: textoMoedaParaValor(inputValor.value),
    condicoes: selectCondicoes.value,
    parcelas: lerParcelas(),
  };

  // Se estava editando um ID diferente do novo ID digitado, remove o antigo
  if (editandoId && editandoId !== id) {
    clientes = clientes.filter((c) => c.id !== editandoId);
  }

  const indexExistente = clientes.findIndex((c) => c.id === id);
  if (indexExistente >= 0) {
    clientes[indexExistente] = cliente;
  } else {
    clientes.push(cliente);
  }

  salvarClientes();
  renderListaClientes();
  mostrarToast("Cliente salvo!");
  limparForm();
});

btnNovo.addEventListener("click", limparForm);

function limparForm() {
  form.reset();
  imagensAtuais = [];
  editandoId = null;
  renderPreviewImagens();
  parcelasContainer.innerHTML = "";
  criarLinhaParcela();
  tituloForm.textContent = "Novo Cliente";
  inputId.removeAttribute("readonly");
  saidaWrap.classList.remove("ativo");
  if (typeof window.carregarItensServico === "function") {
    window.carregarItensServico(null);
  }
}

function carregarClienteNoForm(cliente) {
  editandoId = cliente.id;
  inputId.value = cliente.id;
  inputNome.value = cliente.nome;
  inputContato.value = cliente.contato;
  inputEndereco.value = cliente.endereco;
  inputServico.value = cliente.servico;
  if (typeof window.carregarItensServico === "function") {
    window.carregarItensServico(cliente.servico);
  }
  inputValor.value = valorParaTextoMoeda(cliente.valor);
  selectCondicoes.value = cliente.condicoes;

  imagensAtuais = [...(cliente.imagens || [])];
  renderPreviewImagens();

  parcelasContainer.innerHTML = "";
  if (cliente.parcelas && cliente.parcelas.length) {
    cliente.parcelas.forEach((p) => criarLinhaParcela(p.valor, p.data, p.status));
  } else {
    criarLinhaParcela();
  }

  tituloForm.textContent = "Editando: " + cliente.nome;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Lista de clientes ----------
function renderListaClientes() {
  listaClientesEl.innerHTML = "";
  if (clientes.length === 0) {
    listaClientesEl.innerHTML = '<p class="empty-msg">Nenhum cliente cadastrado ainda.</p>';
  } else {
    clientes.forEach((cliente) => {
      const item = document.createElement("div");
      item.className = "cliente-item";
      item.innerHTML = `
        <div class="info">
          <strong>${cliente.nome || "(sem nome)"}</strong>
          <span>ID: ${cliente.id}</span>
        </div>
        <div class="botoes">
          <button class="btn-gerar">Gerar</button>
          <button class="btn-editar">Editar</button>
          <button class="btn-excluir">Excluir</button>
        </div>
      `;
      item.querySelector(".btn-editar").addEventListener("click", () => carregarClienteNoForm(cliente));
      item.querySelector(".btn-excluir").addEventListener("click", () => excluirCliente(cliente.id));
      item.querySelector(".btn-gerar").addEventListener("click", () => gerarPagina(cliente));
      listaClientesEl.appendChild(item);
    });
  }
  renderResumoFinanceiro();
}

// Soma o valor total de todos os clientes e o quanto já foi pago no total.
function renderResumoFinanceiro() {
  let totalEntrada = 0;
  let totalPago = 0;

  clientes.forEach((cliente) => {
    totalEntrada += Number(cliente.valor) || 0;
    totalPago += calcularTotalPago(cliente);
  });

  const saldo = Math.max(totalEntrada - totalPago, 0);

  resumoEntradaEl.textContent = "R$ " + formatarMoeda(totalEntrada);
  resumoPagoEl.textContent = "R$ " + formatarMoeda(totalPago);
  resumoSaldoEl.textContent = "R$ " + formatarMoeda(saldo);
}

function excluirCliente(id) {
  if (!confirm("Excluir este cliente?")) return;
  clientes = clientes.filter((c) => c.id !== id);
  salvarClientes();
  renderListaClientes();
  mostrarToast("Cliente excluído");
}

// ---------- Geração da página do cliente ----------
function gerarDadosClientesJs() {
  const chavePix = localStorage.getItem(PIX_STORAGE_KEY) || "";
  const config = { chavePix };
  return `// Arquivo gerado pela Matriz de Cadastro - KA-MÃO
// Substitua o arquivo "dados-clientes.js" no GitHub por este conteúdo
// sempre que cadastrar, editar ou excluir um cliente.

const KAMAO_CONFIG = ${JSON.stringify(config, null, 2)};

const KAMAO_CLIENTES = ${JSON.stringify(clientes, null, 2)};
`;
}

function gerarPagina(cliente) {
  const base = localStorage.getItem(LINK_BASE_STORAGE_KEY) || inputLinkBase.value.trim() || LINK_BASE_PADRAO;
  // ATENÇÃO: o nome do arquivo aqui precisa ser IDÊNTICO (maiúsculas/minúsculas
  // incluídas) ao arquivo que existe de fato no repositório do GitHub.
  // A página pública do cliente é o "index.html".
  const link = base + "index.html?id=" + cliente.id;

  nomeClienteSaida.textContent = cliente.nome;
  linkPronto.textContent = link;
  linkPronto.dataset.link = link;

  saidaDados.value = gerarDadosClientesJs();

  saidaWrap.classList.add("ativo");
  saidaWrap.scrollIntoView({ behavior: "smooth" });
}

btnCopiarLink.addEventListener("click", () => {
  const link = linkPronto.dataset.link || "";
  navigator.clipboard.writeText(link).then(
    () => mostrarToast("Link copiado!"),
    () => {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      mostrarToast("Link copiado!");
    }
  );
});

btnCopiarDados.addEventListener("click", () => {
  saidaDados.select();
  document.execCommand("copy");
  mostrarToast("Código copiado!");
});

// ---------- Inicialização ----------
popularSelectGaleria();
criarLinhaParcela();
renderListaClientes();
