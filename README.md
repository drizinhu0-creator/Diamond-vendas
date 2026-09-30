# 🛒 Pix Sales Bot v2 — Bot de vendas para Discord

Bot de vendas completo, no mesmo estilo da loja do vídeo que você mandou (produtos com
várias opções, carrinho editável, tela de pagamento), mas com **pagamento 100% manual**:
o bot gera o Pix (QR Code + copia-e-cola) com a sua chave fixa, sem gateway nenhum, e um
atendente confere e confirma na mão.

## O que tem

- **Produtos com variações**: cada produto pode ter várias opções (ex: "Mensal", "Anual",
  "Trial"), cada uma com seu próprio preço e estoque — igual ao menu "Clique aqui para ver
  as opções" do vídeo.
- **Carrinho completo**, num canal privado por cliente:
  - Adicionar vários itens (de produtos diferentes) no mesmo carrinho
  - Editar quantidade de cada item (ou remover, colocando `0`)
  - Aplicar cupom de desconto (percentual ou valor fixo)
  - Cancelar o carrinho
  - Ir para a tela de pagamento (com botão de voltar)
- **Pagamento Pix manual**: o bot monta o QR Code e o código "copia e cola" localmente,
  com a sua chave Pix fixa (sem Mercado Pago, Pagar.me, etc.). O cliente paga, manda o
  comprovante no próprio canal, e um atendente (Admin ou cargo staff) clica em
  **✅ Confirmar pagamento** — nesse momento o estoque é baixado e a venda vai pro log.
- **Aviso de reposição**: se a opção escolhida estiver esgotada, aparece um botão
  "🔔 Avisar quando o estoque voltar" — quando o admin repõe o estoque, todo mundo que
  clicou recebe um aviso por DM.
- **Expiração automática**: pedido que ficou 30 minutos aguardando confirmação expira
  sozinho.
- **Relatório de vendas** (`/vendas`) e **log de vendas** em canal separado, além do
  **canal de entregas** (`/entregas`) onde a embed **Compra Aprovada** é publicada a
  cada venda confirmada.
- Todos os dados (produtos, variações, carrinhos/pedidos, cupons, config) ficam no
  **MongoDB**.

---

## 1. Pré-requisitos

- [Node.js](https://nodejs.org) versão 18 ou superior
- Uma conta no [Discord Developer Portal](https://discord.com/developers/applications)
- Um banco **MongoDB** — pode ser grátis no [MongoDB Atlas](https://www.mongodb.com/atlas)
  ou um MongoDB rodando localmente
- Uma chave Pix sua (CPF, CNPJ, e-mail, telefone ou chave aleatória) para receber os
  pagamentos

---

## 2. Criar o bot no Discord

1. Acesse https://discord.com/developers/applications e clique em **New Application**.
2. Vá em **Bot** → **Add Bot**. Copie o **Token** (isso vai no `.env`).
3. Não é necessário ativar nenhum "Privileged Gateway Intent" — o bot funciona só com
   interações (comandos, botões, selects e modais).
4. Vá em **OAuth2 → General** e copie o **Client ID** (também vai no `.env`).
5. Vá em **OAuth2 → URL Generator**:
   - Scopes: `bot` e `applications.commands`
   - Permissões do bot: `Send Messages`, `Embed Links`, `Attach Files`, `Read Message
     History`, `Manage Channels`, `Manage Messages`
6. Copie o link gerado e use para convidar o bot para o seu servidor.

---

## 3. Instalar e configurar o projeto

```bash
cd pix-sales-bot
npm install
cp .env.example .env
```

Abra o `.env` e preencha:

```
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...        # opcional, mas recomendado durante os testes
MONGODB_URI=...      # string de conexão do seu MongoDB
```

> `GUILD_ID` é o ID do seu servidor de testes. Com ele, os comandos aparecem
> instantaneamente. Sem ele, o registro é global e pode levar até 1h para propagar.

Registre os comandos e inicie o bot:

```bash
npm run deploy-commands
npm start
```

---

## 4. Configurar o servidor (uma vez só)

Dentro do Discord, como administrador:

```
/config canal-logs canal:<canal onde as vendas confirmadas aparecem>
/config cargo-staff cargo:<cargo que atende os clientes e confirma pagamentos>
/config chave-pix chave:<sua chave Pix> nome:<seu nome/nome da loja> cidade:<sua cidade>
/entregas canal:<canal onde as compras aprovadas são publicadas>
```

> `nome` e `cidade` aparecem no aplicativo do banco de quem for pagar (exigidos pelo
> padrão Pix). `nome` até 25 caracteres, `cidade` até 15 — o bot corta e remove acentos
> automaticamente se precisar.

⚠️ **Importante**: os carrinhos são **canais privados** (um por cliente, escondidos do
`@everyone`). O cargo staff configurado com `/config cargo-staff` recebe acesso
automaticamente a cada carrinho criado — para isso o bot precisa da permissão
**Gerenciar Canais (Manage Channels)** no servidor. O canal é criado na mesma categoria
do canal onde o `/painel-loja` foi publicado.

Sem a chave Pix configurada, o botão **Pix** não gera cobrança.

---

## 5. Cadastrar produtos, variações e publicar a loja

```
/produto-add nome:"N1TR0 L1NKs" descricao:"Ative o Nitro por um tempo" emoji:"🔥" imagem:"https://.../banner.png"
/produto-variacao-add produto:<selecione> nome:"Mensal" preco:0.10 estoque:20
/produto-variacao-add produto:<selecione> nome:"Ativação" preco:1.40 estoque:9916
/produto-listar
/produto-variacao-estoque produto:<selecione> variacao:<selecione> quantidade:50
/produto-variacao-remover produto:<selecione> variacao:<selecione>
/produto-editar produto:<selecione> preco... (nome/descricao/emoji/imagem/ativo)
/produto-remover produto:<selecione>
```

Cupons (opcional):

```
/cupom-add codigo:"BEMVINDO10" tipo:percentual valor:10
/cupom-add codigo:"PROMO5" tipo:fixo valor:5 usos-max:50
/cupom-remover codigo:"BEMVINDO10"
```

Em qualquer canal onde os clientes vão comprar:

```
/painel-loja
```

O comando abre um **editor efêmero** (só você vê):

1. Escolha **🔘 Botão** (um botão de compra por variação) ou **📋 Menu de seleção**
   (barra suspensa com as variações).
2. Use os botões **📝 Nome**, **📄 Descrição**, **🛍️ Produto**, **📦 Estoque**
   (repor o estoque real da variação) e **🎨 Cor**; confira em **👁️ Prévia**.
3. **🚀 Publicar** manda o painel para o canal. **❌ Cancelar** descarta o rascunho.

A embed publicada mostra o produto com imagem e estoque, e o botão de compra usa a
imagem do painel no carrinho do cliente.

Painéis publicados com versões antigas do comando mostram um aviso para republicar.

---

## 6. Como funciona a compra (fluxo do cliente)

1. Cliente clica no menu **"Clique aqui para ver as opções"** do produto e escolhe uma
   variação.
   - Se estiver esgotada: aparece o botão **"Avisar quando o estoque voltar"**.
2. O bot cria (ou reaproveita, se já tiver um aberto) um **canal privado** com o
   cliente, mostrando a **Revisão do Pedido**: itens, subtotal, total.
3. Dentro do canal, o cliente pode:
   - **Adicionar mais um item ao carrinho** (menu suspenso com todas as variações da
     loja)
   - **Editar Quantidade** (digita a nova quantidade num formulário; `0` remove o item)
   - **Usar Cupom** (digita o código)
    - **Cancelar** o carrinho (o canal é apagado em instantes)
   - **Ir para o Pagamento**
4. Na tela de pagamento, o cliente clica em **Pix**. O bot gera o QR Code e o código
   "copia e cola" **localmente**, com a chave Pix cadastrada — sem depender de nenhuma
   API externa.
5. Cliente paga e manda o comprovante no próprio canal.
6. Um atendente (Administrador ou cargo staff) confere o pagamento e clica em
   **✅ Confirmar pagamento**. Nesse momento: o estoque de cada item é reduzido, o
   cliente recebe a confirmação, a venda é registrada no canal de logs e, se o canal
   de entregas estiver configurado com `/entregas`, a embed **Compra Aprovada**
   (comprador, data, produtos, desconto, total e imagem do produto) é publicada lá
   marcando o comprador. **10 segundos depois o canal do carrinho é apagado.**
7. Se o pagamento não acontecer, o atendente (ou o próprio cliente, pelo botão **❌ Cancelar
   pedido**) cancela o pedido — o carrinho é fechado e o canal é apagado.
8. Atendente entrega o produto manualmente (arquivo, código, acesso, etc.) — o canal
   do carrinho é apagado automaticamente **10 segundos** após a confirmação.
9. Se ninguém pagar em 30 minutos após gerar o Pix, o pedido expira sozinho.

---

## 7. Diferenças em relação ao vídeo de referência

- Igual ao vídeo: produtos com várias opções/variações, menu "Clique aqui para ver as
  opções", carrinho com revisão do pedido, adicionar item, editar
  quantidade, cupom, tela "Forma de Pagamento", aviso de estoque esgotado.
- Diferente (a seu pedido): a tela de pagamento só tem o botão **Pix**, e a confirmação
  é **sempre manual** — o bot não verifica nada automaticamente com nenhum banco ou
  gateway (o vídeo mostrava também Cartão e cripto, que dependeriam de um gateway de
  pagamento de verdade).
- Entrega do produto também é manual (o atendente manda no canal do carrinho).

---

## 8. Estrutura do projeto

```
pix-sales-bot/
├── index.js                        # inicia o bot
├── deploy-commands.js               # registra os slash commands
├── src/
│   ├── db/mongo.js                  # conexão com o MongoDB
│   ├── models/                      # schemas Mongoose (Produto, Pedido, Config, Cupom, AvisoEstoque, MembroVerificado, Personalizacao)
│   ├── pix.js                       # gera o payload Pix "copia e cola" localmente (chave fixa)
│   ├── carrinho.js                  # cálculo de totais + montagem dos embeds/botões do carrinho
│   ├── carrinhoThread.js            # criação do canal privado do carrinho e helpers
│   ├── personalizacao.js            # leitura/aplicação das personalizações (emoji de botões, cor/título de embeds)
│   ├── registroPersonalizacao.js    # catálogo das chaves personalizáveis (usado pelo /personalizar)
│   ├── painelEditor.js              # rascunho/preview/publicação do painel criado pelo /painel-loja
│   ├── autocomplete.js              # autocomplete de produto/variação nos comandos
│   ├── expiracao.js                 # expira pedidos não confirmados após 30 minutos
│   ├── commands/                    # todos os comandos /slash
│   └── events/                      # ready + interactionCreate (selects/botões/modais)
├── .env.example
└── package.json
```
