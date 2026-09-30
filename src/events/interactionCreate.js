const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');
const QRCode = require('qrcode');
const mongoose = require('mongoose');

const Produto = require('../models/Produto');
const Pedido = require('../models/Pedido');
const Config = require('../models/Config');
const Cupom = require('../models/Cupom');
const AvisoEstoque = require('../models/AvisoEstoque');
const MembroVerificado = require('../models/MembroVerificado');

const {
  formatarReal,
  calcularTotais,
  montarEmbedRevisao,
  montarComponentesRevisao,
  montarEmbedPagamento,
  montarComponentesPagamento,
  construirOpcoesTodasVariacoes,
  montarEmbedEntrega,
  montarEmbedCompraAprovada,
  aplicarImagensItens,
} = require('../carrinho');
const { obterPedidoAberto, criarCanalCarrinho, adicionarItemAoPedido, novoCodigoPedidoUnico } = require('../carrinhoThread');
const { gerarPayloadPix } = require('../pix');
const { agendarExpiracao } = require('../expiracao');
const {
  obterPersonalizacao,
  aplicarEmoji,
  aplicarEmbedChrome,
  abrirSeletorEmoji,
  abrirSeletorEmbed,
  abrirModalEmoji,
  abrirModalEmbed,
  salvarEmoji,
  salvarEmbed,
} = require('../personalizacao');
const {
  criarDraft,
  obterDraft,
  limparDraft,
  montarMensagemEditor,
  montarPainelCliente,
  menuProdutos,
  menuCores,
  menuVariacoesEstoque,
  modalNome,
  modalDesc,
  modalEstoque,
} = require('../painelEditor');
const { ehDono, montarConfirmacaoSaida } = require('../tirar');

function idValido(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

async function buscarPedido(id) {
  return idValido(id) ? Pedido.findById(id) : null;
}

async function buscarProdutoPorId(id) {
  return idValido(id) ? Produto.findById(id) : null;
}

async function buscarProdutoDaGuild(id, guildId) {
  return idValido(id) ? Produto.findOne({ _id: id, guildId }) : null;
}

function ehStaff(interaction, cfg) {
  if (interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg?.cargoStaffId && interaction.member?.roles?.cache?.has(cfg.cargoStaffId)) return true;
  return false;
}

async function registrarLog(client, guildId, embed) {
  try {
    const cfg = await Config.findOne({ guildId });
    if (!cfg?.canalLogsId) return;
    const canal = await client.channels.fetch(cfg.canalLogsId).catch(() => null);
    if (canal) await canal.send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
}

async function fecharCanalCarrinho(client, canalId, motivo, atrasoMs = 3000) {
  if (!canalId) return false;
  const canal = await client.channels.fetch(canalId).catch((err) => {
    console.error('❌ Erro ao buscar o canal do carrinho:', err.message);
    return null;
  });
  if (!canal) return false;

  setTimeout(async () => {
    try {
      await canal.delete(motivo);
    } catch (err) {
      console.error('❌ Não consegui apagar o canal do carrinho:', err.message);
      if (canal.isThread?.()) {
        await canal.setLocked(true, motivo).catch(() => null);
        await canal
          .setArchived(true, motivo)
          .catch((err2) => console.error('❌ Também não consegui arquivar a thread:', err2.message));
      }
    }
  }, atrasoMs);
  return true;
}

// Publica a embed "Compra Aprovada" no canal de entregas configurado com /entregas.
async function publicarCompraAprovada(client, pedido, { canalEntregasId, totalFinal, desconto = 0, personalizacao }) {
  try {
    const canal = await client.channels.fetch(canalEntregasId).catch((err) => {
      console.error('❌ Não consegui abrir o canal de entregas:', err.message);
      return null;
    });
    if (!canal) return false;

    if (!pedido.itens.some((i) => i.imagemUrl)) {
      const produtos = await Produto.find({ guildId: pedido.guildId, ativo: true });
      aplicarImagensItens(pedido, produtos);
    }
    const imagemUrl = pedido.itens.find((i) => i.imagemUrl)?.imagemUrl || null;

    const comprador = await client.users.fetch(pedido.userId).catch(() => null);
    const avatarUrl = comprador ? comprador.displayAvatarURL({ size: 256 }) : null;

    const embed = montarEmbedCompraAprovada(
      pedido,
      { totalFinal, desconto, confirmadoEm: pedido.pagoEm, imagemUrl, avatarUrl },
      personalizacao
    );

    await canal.send({ content: `<@${pedido.userId}>`, embeds: [embed] });
    return true;
  } catch (err) {
    console.error('❌ Erro ao publicar a compra aprovada:', err.message);
    return false;
  }
}

async function reenviarEmbedRevisao(interaction, pedido) {
  const produtos = await Produto.find({ guildId: pedido.guildId, ativo: true });
  aplicarImagensItens(pedido, produtos);
  const opcoesAddItem = construirOpcoesTodasVariacoes(produtos);
  const personalizacao = await obterPersonalizacao(pedido.guildId);
  await interaction.update({
    embeds: [montarEmbedRevisao(pedido, personalizacao)],
    components: montarComponentesRevisao(pedido, opcoesAddItem, personalizacao),
  });
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        if (err?.code !== 10062) console.error('Erro no autocomplete:', err);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        if (err?.code === 10062 || err?.code === 40060) return;
        try {
          const msg = { content: '❌ Ocorreu um erro ao executar esse comando.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
          else await interaction.reply(msg);
        } catch (err2) {
          console.error('Erro ao avisar o usuário sobre a falha:', err2);
        }
      }
      return;
    }

    try {
      await handleComponentInteraction(interaction, client);
    } catch (err) {
      console.error('Erro ao processar interação:', err);
      if (err?.code === 10062 || err?.code === 40060) return;
      const msg = { content: '❌ Ocorreu um erro ao processar essa ação. Tente novamente.', ephemeral: true };
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else if (interaction.isRepliable()) await interaction.reply(msg);
      } catch (err2) {
        console.error('Erro ao avisar o usuário sobre a falha:', err2);
      }
    }
  },
};

async function handleComponentInteraction(interaction, client) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'tirarsel') {
    if (!(await ehDono(client, interaction.user.id))) {
      return interaction.reply({ content: '❌ Apenas o **dono do bot** pode usar esse painel.', ephemeral: true });
    }
    const guild = client.guilds.cache.get(interaction.values[0]);
    if (!guild) {
      return interaction.update({ content: '⚠️ Não estou mais nesse servidor.', embeds: [], components: [] });
    }
    return interaction.update(montarConfirmacaoSaida(guild));
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('opcoes_')) {
    const [produtoId, variacaoId] = interaction.values[0].split(':');
    return adicionarDoPainel(interaction, client, produtoId, variacaoId);
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'painelselecionar') {
    // Painel publicado com a versão antiga do /painel-loja.
    return interaction.update({
      content: '⚠️ Esse painel ficou desatualizado. Peça a um admin para publicar de novo com `/painel-loja`.',
      components: [],
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'paineltipo') {
    const draft = criarDraft(interaction.guild.id, interaction.user.id, interaction.values[0]);
    const primeiro = await Produto.findOne({ guildId: interaction.guild.id, ativo: true });
    if (primeiro) draft.produtoId = String(primeiro._id);
    return interaction.update(montarMensagemEditor(draft, primeiro));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'pnlproduto') {
    const draft = obterDraft(interaction.guild.id, interaction.user.id);
    if (!draft) return sessaoEditorExpirada(interaction);
    draft.produtoId = interaction.values[0];
    draft.variacaoEstoqueId = null;
    const produto = await produtoDoDraft(draft, interaction.guild.id);
    return interaction.update(montarMensagemEditor(draft, produto));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'pnlcor') {
    const draft = obterDraft(interaction.guild.id, interaction.user.id);
    if (!draft) return sessaoEditorExpirada(interaction);
    draft.cor = interaction.values[0];
    const produto = await produtoDoDraft(draft, interaction.guild.id);
    return interaction.update(montarMensagemEditor(draft, produto));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'pnlestvar') {
    const draft = obterDraft(interaction.guild.id, interaction.user.id);
    if (!draft) return sessaoEditorExpirada(interaction);
    const produto = await produtoDoDraft(draft, interaction.guild.id);
    const variacao = produto?.variacoes.id(interaction.values[0]);
    if (!produto || !variacao) return sessaoEditorExpirada(interaction);
    draft.variacaoEstoqueId = String(variacao._id);
    return interaction.showModal(modalEstoque(variacao));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'pers_selemoji') {
    return abrirModalEmoji(interaction, interaction.values[0]);
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'pers_selembed') {
    return abrirModalEmbed(interaction, interaction.values[0]);
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('additem_')) {
    const pedidoId = interaction.customId.split('_')[1];
    const pedido = await buscarPedido(pedidoId);
    if (!pedido || !['carrinho', 'pagamento'].includes(pedido.status)) {
      return interaction.reply({ content: '⚠️ Esse carrinho não está mais disponível.', ephemeral: true });
    }
    const [produtoId, variacaoId] = interaction.values[0].split(':');
    const produto = await buscarProdutoDaGuild(produtoId, interaction.guild.id);
    const variacao = produto?.variacoes.id(variacaoId);
    if (!produto || !variacao) {
      return interaction.reply({ content: '❌ Essa opção não existe mais.', ephemeral: true });
    }
    if (variacao.estoque <= 0) {
      return interaction.reply({ content: '❌ Essa opção está esgotada.', ephemeral: true });
    }
    pedido.status = 'carrinho';
    adicionarItemAoPedido(pedido, produto, variacao);
    await pedido.save();
    await reenviarEmbedRevisao(interaction, pedido);
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selqtd_')) {
    const pedidoId = interaction.customId.split('_')[1];
    const itemId = interaction.values[0];
    return abrirModalQuantidade(interaction, pedidoId, itemId);
  }

  if (interaction.isButton()) {
    const [acao, resto] = splitCustomId(interaction.customId);

    if (acao === 'tirarcancel' || acao === 'tirarconf') {
      if (!(await ehDono(client, interaction.user.id))) {
        return interaction.reply({ content: '❌ Apenas o **dono do bot** pode usar esse painel.', ephemeral: true });
      }

      if (acao === 'tirarcancel') {
        return interaction.update({ content: '❌ Saída cancelada.', embeds: [], components: [] });
      }

      const guild = client.guilds.cache.get(resto);
      if (!guild) {
        return interaction.update({ content: '⚠️ Não estou mais nesse servidor.', embeds: [], components: [] });
      }

      const nome = guild.name;
      try {
        await guild.leave();
      } catch (err) {
        console.error(`Erro ao sair do servidor ${nome} (${resto}):`, err.message);
        return interaction.update({
          content: `❌ Não consegui sair de **${nome}** (${err.message}).`,
          embeds: [],
          components: [],
        });
      }

      console.log(`🚪 Saí do servidor ${nome} (${resto}) por pedido de ${interaction.user.tag}`);
      // Se o painel estava no próprio servidor que o bot acabou de sair, o edit falha — tudo bem.
      return interaction
        .update({
          content: `✅ Saí do servidor **${nome}** (\`${resto}\`).`,
          embeds: [],
          components: [],
        })
        .catch(() => null);
    }

    if (acao === 'pers') {
      if (resto === 'abriremoji') return abrirSeletorEmoji(interaction);
      if (resto === 'abrirembed') return abrirSeletorEmbed(interaction);
    }

    if (acao === 'opcoesbtn') {
      const [produtoId, variacaoId] = resto.split(':');
      return adicionarDoPainel(interaction, client, produtoId, variacaoId);
    }

    if (acao === 'pnlbtn') {
      const draft = obterDraft(interaction.guild.id, interaction.user.id);
      if (!draft) return sessaoEditorExpirada(interaction);

      if (resto === 'nome') return interaction.showModal(modalNome(draft));
      if (resto === 'desc') return interaction.showModal(modalDesc(draft));
      if (resto === 'cancelar') {
        limparDraft(interaction.guild.id, interaction.user.id);
        return interaction.update({ content: '❌ Edição do painel cancelada.', embeds: [], components: [] });
      }

      const produto = await produtoDoDraft(draft, interaction.guild.id);

      if (resto === 'produto') {
        const produtos = await Produto.find({ guildId: interaction.guild.id, ativo: true }).limit(25);
        if (produtos.length === 0) {
          return interaction.reply({ content: 'Cadastre produtos primeiro com `/produto-add`.', ephemeral: true });
        }
        return interaction.update(
          montarMensagemEditor(draft, produto, [menuProdutos(produtos)], '🛍️ Qual produto vai no painel?')
        );
      }

      if (resto === 'cor') {
        return interaction.update(montarMensagemEditor(draft, produto, [menuCores()], '🎨 Qual cor a embed deve ter?'));
      }

      if (resto === 'estoque') {
        if (!produto) {
          return interaction.reply({ content: '⚠️ Escolha um produto primeiro no botão **🛍️ Produto**.', ephemeral: true });
        }
        const ativas = produto.variacoes.filter((v) => v.ativo);
        if (ativas.length === 0) {
          return interaction.reply({ content: '⚠️ Esse produto não tem variações ativas.', ephemeral: true });
        }
        if (ativas.length === 1) {
          draft.variacaoEstoqueId = String(ativas[0]._id);
          return interaction.showModal(modalEstoque(ativas[0]));
        }
        return interaction.update(
          montarMensagemEditor(draft, produto, [menuVariacoesEstoque(produto)], '📦 Qual variação você quer repor o estoque?')
        );
      }

      if (resto === 'previa') {
        return interaction.update(
          montarMensagemEditor(draft, produto, [], '👁️ **Prévia atualizada!** Confira a embed abaixo.')
        );
      }

      if (resto === 'publicar') {
        if (!produto) {
          return interaction.reply({ content: '⚠️ Escolha um produto primeiro no botão **🛍️ Produto**.', ephemeral: true });
        }
        await interaction.deferUpdate();
        const personalizacaoPainel = await obterPersonalizacao(interaction.guild.id);
        await interaction.channel.send(montarPainelCliente(draft, produto, personalizacaoPainel));
        limparDraft(interaction.guild.id, interaction.user.id);
        return interaction.editReply({ content: '✅ Painel publicado neste canal!', embeds: [], components: [] });
      }
    }

    if (acao === 'editarqtd') {
      const pedidoId = resto;
      const pedido = await buscarPedido(pedidoId);
      if (!pedido || pedido.itens.length === 0) {
        return interaction.reply({ content: '⚠️ Carrinho vazio.', ephemeral: true });
      }
      if (pedido.itens.length === 1) {
        return abrirModalQuantidade(interaction, pedidoId, String(pedido.itens[0]._id));
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId(`selqtd_${pedidoId}`)
        .setPlaceholder('Qual item deseja editar?')
        .addOptions(pedido.itens.map((i) => ({
          label: `${i.quantidade}x ${i.produtoNome} — ${i.variacaoNome}`.slice(0, 100),
          value: String(i._id),
        })));
      return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    if (acao === 'usarcupom') {
      const modal = new ModalBuilder().setCustomId(`modalcupom_${resto}`).setTitle('Usar cupom de desconto');
      const input = new TextInputBuilder()
        .setCustomId('codigo').setLabel('Código do cupom').setStyle(TextInputStyle.Short)
        .setRequired(true).setPlaceholder('Ex: BEMVINDO10');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (acao === 'cancelarcarrinho') {
      await interaction.deferUpdate();

      const pedido = await buscarPedido(resto);
      if (!pedido || !['carrinho', 'pagamento'].includes(pedido.status)) {
        return interaction.editReply({
          content: '⚠️ Esse carrinho já não está mais aberto.',
          embeds: [],
          components: [],
        });
      }

      pedido.status = 'cancelado';
      await pedido.save();

      try {
        await interaction.editReply({
          content: `<@${pedido.userId}>`,
          embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('🗑️ Carrinho cancelado. Este canal será apagado em instantes.')],
          components: [],
        });
      } catch (err) {
        console.error('❌ Erro ao atualizar a mensagem de cancelamento:', err.message);
      }

      const embedLogCancel = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🗑️ Carrinho cancelado')
        .setDescription(`<@${interaction.user.id}> cancelou o carrinho.`)
        .addFields(
          { name: 'Pedido', value: `\`${pedido.codigo}\``, inline: true },
          { name: 'Cliente', value: `<@${pedido.userId}>`, inline: true }
        )
        .setTimestamp();
      await registrarLog(client, interaction.guild.id, embedLogCancel);

      await fecharCanalCarrinho(client, pedido.threadId, 'Carrinho cancelado pelo cliente');
      return;
    }

    if (acao === 'irpagamento') {
      const pedido = await buscarPedido(resto);
      if (!pedido || pedido.itens.length === 0) {
        return interaction.reply({ content: '⚠️ Seu carrinho está vazio.', ephemeral: true });
      }
      pedido.status = 'pagamento';
      await pedido.save();
      if (pedido.itens.some((i) => !i.imagemUrl)) {
        const produtos = await Produto.find({ guildId: pedido.guildId, ativo: true });
        aplicarImagensItens(pedido, produtos);
      }
      const personalizacaoPagamento = await obterPersonalizacao(interaction.guild.id);
      await interaction.update({
        embeds: [montarEmbedPagamento(pedido, personalizacaoPagamento)],
        components: montarComponentesPagamento(pedido, personalizacaoPagamento),
      });
      return;
    }

    if (acao === 'voltarcarrinho') {
      const pedido = await buscarPedido(resto);
      if (!pedido) return interaction.reply({ content: '⚠️ Carrinho não encontrado.', ephemeral: true });
      pedido.status = 'carrinho';
      await pedido.save();
      return reenviarEmbedRevisao(interaction, pedido);
    }

    if (acao === 'pix') {
      const pedido = await buscarPedido(resto);
      if (!pedido || pedido.status !== 'pagamento') {
        return interaction.reply({ content: '⚠️ Esse pedido não está mais aguardando pagamento.', ephemeral: true });
      }
      const cfg = await Config.findOne({ guildId: interaction.guild.id });
      if (!cfg?.chavePix) {
        return interaction.reply({ content: '❌ A loja ainda não configurou a chave Pix. Peça a um administrador para rodar `/config chave-pix`.', ephemeral: true });
      }
      if (!cfg?.cargoStaffId) {
        return interaction.reply({ content: '❌ A loja ainda não configurou o cargo de staff. Peça a um administrador para rodar `/config cargo-staff`.', ephemeral: true });
      }

      const personalizacaoPix = await obterPersonalizacao(interaction.guild.id);

      const embedAguardando = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🔒 Solicitação de PIX recebida')
        .setDescription(
          `Olá <@${pedido.userId}>! Sua solicitação de pagamento foi registrada.\n\n` +
          `⏳ **A chave PIX será liberada manualmente por um membro da equipe** (<@&${cfg.cargoStaffId}>).\n` +
          `Assim que um atendente liberar, o QR Code e o "copia e cola" aparecerão aqui e você receberá um lembrete na sua DM.`
        )
        .setFooter({ text: `Pedido ${pedido.codigo}` });

      const linhaLiberar = new ActionRowBuilder().addComponents(
        aplicarEmoji(new ButtonBuilder().setCustomId(`liberarpix_${pedido._id}`).setLabel('Liberar chave PIX').setStyle(ButtonStyle.Success), 'liberarpix', personalizacaoPix),
        aplicarEmoji(new ButtonBuilder().setCustomId(`cancelarpg_${pedido._id}`).setLabel('Cancelar pedido').setStyle(ButtonStyle.Danger), 'cancelarpg', personalizacaoPix)
      );

      await interaction.update({
        embeds: [montarEmbedPagamento(pedido, personalizacaoPix).setFooter({ text: 'Aguardando um atendente liberar a chave PIX' })],
        components: [],
      });

      const canal = await client.channels.fetch(pedido.threadId).catch(() => null);
      if (!canal) {
        return interaction.followUp({ content: '❌ Não encontrei o canal desse carrinho.', ephemeral: true });
      }
      await canal.send({
        content: `<@&${cfg.cargoStaffId}> — o cliente <@${pedido.userId}> solicitou pagamento via PIX.`,
        embeds: [embedAguardando],
        components: [linhaLiberar],
      });

      const embedLogSolicitou = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💳 PIX solicitado')
        .setDescription(`<@${pedido.userId}> solicitou pagamento via PIX. Aguardando liberação da equipe.`)
        .addFields(
          { name: 'Pedido', value: `\`${pedido.codigo}\``, inline: true },
          { name: 'Canal', value: `<#${canal.id}>`, inline: true }
        )
        .setTimestamp();
      await registrarLog(client, interaction.guild.id, embedLogSolicitou);
      return;
    }

    if (acao === 'liberarpix') {
      const pedido = await buscarPedido(resto);
      const cfg = await Config.findOne({ guildId: interaction.guild.id });

      if (!ehStaff(interaction, cfg)) {
        return interaction.reply({ content: '❌ Só a equipe pode liberar a chave PIX.', ephemeral: true });
      }
      if (!pedido || pedido.status !== 'pagamento') {
        return interaction.reply({ content: '⚠️ Esse pedido não está mais aguardando pagamento.', ephemeral: true });
      }
      if (!cfg?.chavePix) {
        return interaction.reply({ content: '❌ A loja ainda não configurou a chave Pix. Rode `/config chave-pix`.', ephemeral: true });
      }

      const { totalFinal } = calcularTotais(pedido);
      const personalizacaoLiberar = await obterPersonalizacao(interaction.guild.id);

      const payload = gerarPayloadPix({
        chave: cfg.chavePix, nome: cfg.nomeRecebedor, cidade: cfg.cidadeRecebedor,
        valor: totalFinal, txid: pedido.codigo,
      });

      let arquivos = [];
      try {
        const qrBuffer = await QRCode.toBuffer(payload, { type: 'png', width: 400, margin: 1 });
        arquivos = [new AttachmentBuilder(qrBuffer, { name: 'qrcode.png' })];
      } catch (err) {
        console.error('Erro ao gerar imagem do QR Code Pix:', err.message);
      }

      const embedPedido = new EmbedBuilder().setColor(0x57f287);
      aplicarEmbedChrome(embedPedido, 'pedidoPix', personalizacaoLiberar, { codigo: pedido.codigo });
      embedPedido
        .setDescription(
          `Chave PIX liberada por <@${interaction.user.id}>.\n\n` +
          `Valor: **${formatarReal(totalFinal)}**\n\n` +
          'Escaneie o QR Code abaixo ou copie o código Pix logo em seguida para pagar.\n\n' +
          '⚠️ **A confirmação é manual**: depois de pagar, envie o comprovante aqui. ' +
          'Um atendente vai conferir e clicar em **Confirmar pagamento**.'
        )
        .setFooter({ text: 'Aguardando confirmação de um atendente • expira em 30 minutos' });

      if (arquivos.length > 0) embedPedido.setImage('attachment://qrcode.png');

      const linhaCopiar = new ActionRowBuilder().addComponents(
        aplicarEmoji(new ButtonBuilder().setCustomId(`copiarpix_${pedido._id}`).setLabel('Código copia e cola').setStyle(ButtonStyle.Secondary), 'copiarpix', personalizacaoLiberar)
      );
      const linhaStaffConfirmar = new ActionRowBuilder().addComponents(
        aplicarEmoji(new ButtonBuilder().setCustomId(`confirmarpg_${pedido._id}`).setLabel('Confirmar pagamento').setStyle(ButtonStyle.Success), 'confirmarpg', personalizacaoLiberar),
        aplicarEmoji(new ButtonBuilder().setCustomId(`cancelarpg_${pedido._id}`).setLabel('Cancelar pedido').setStyle(ButtonStyle.Danger), 'cancelarpg', personalizacaoLiberar)
      );

      const linhaLiberado = new ActionRowBuilder().addComponents(
        aplicarEmoji(new ButtonBuilder().setCustomId('pixliberado').setLabel(`PIX liberado por ${interaction.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true), 'liberarpix', personalizacaoLiberar)
      );
      await interaction.update({ components: [linhaLiberado] });

      const canal = interaction.channel;
      await canal.send({
        content: `<@${pedido.userId}>`,
        embeds: [embedPedido], files: arquivos,
        components: [linhaCopiar, linhaStaffConfirmar],
      });

      // Lembrete na DM do comprador
      try {
        const usuario = await client.users.fetch(pedido.userId);
        const urlCanal = `https://discord.com/channels/${interaction.guild.id}/${canal.id}`;
        const embedDm = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🔑 Sua chave PIX foi liberada!')
          .setDescription(
            `Olá! A equipe de **${interaction.guild.name}** liberou a chave PIX do seu pedido \`${pedido.codigo}\`.\n\n` +
            `💰 Valor: **${formatarReal(totalFinal)}**\n` +
            `⏰ Você tem **30 minutos** para pagar antes que a cobrança expire.\n\n` +
            'Volte ao seu carrinho para ver o QR Code e o código "copia e cola".'
          )
          .setFooter({ text: 'Após pagar, envie o comprovante no canal do seu pedido.' });
        const linhaDm = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Ir para o carrinho').setStyle(ButtonStyle.Link).setURL(urlCanal)
        );
        await usuario.send({ embeds: [embedDm], components: [linhaDm] });
      } catch (errDm) {
        console.error('Não consegui enviar DM ao comprador:', errDm.message);
        await canal.send(`⚠️ <@${pedido.userId}>, não consegui te avisar por DM (talvez você tenha DMs fechadas). Confira o QR Code acima.`).catch(() => null);
      }

      const embedLogLiberado = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🔑 Chave PIX liberada')
        .setDescription(`<@${interaction.user.id}> liberou a chave PIX para <@${pedido.userId}>.`)
        .addFields(
          { name: 'Pedido', value: `\`${pedido.codigo}\``, inline: true },
          { name: 'Valor', value: formatarReal(totalFinal), inline: true },
          { name: 'Canal', value: `<#${canal.id}>`, inline: true }
        )
        .setTimestamp();
      await registrarLog(client, interaction.guild.id, embedLogLiberado);

      agendarExpiracao(client, pedido._id, canal.id);
      return;
    }

    if (acao === 'copiarpix') {
      const pedido = await buscarPedido(resto);
      if (!pedido || pedido.status !== 'pagamento') {
        return interaction.reply({ content: '⚠️ Esse pedido não está mais aguardando pagamento.', ephemeral: true });
      }
      const cfg = await Config.findOne({ guildId: interaction.guild.id });
      if (!cfg?.chavePix) {
        return interaction.reply({ content: '❌ A chave Pix da loja não está mais configurada.', ephemeral: true });
      }
      const chaveLimpa = String(cfg.chavePix).replace(/["'“”‘’`]/g, '').trim();
      return interaction.reply({ content: `\`${chaveLimpa}\``, ephemeral: true });
    }

    if (acao === 'confirmarpg') {
      const pedido = await buscarPedido(resto);
      const cfg = await Config.findOne({ guildId: interaction.guild.id });

      if (!ehStaff(interaction, cfg)) {
        return interaction.reply({ content: '❌ Só a equipe pode confirmar pagamentos.', ephemeral: true });
      }
      if (!pedido || pedido.status !== 'pagamento') {
        return interaction.reply({ content: '⚠️ Esse pedido já não está mais pendente.', ephemeral: true });
      }

      for (const item of pedido.itens) {
        const produto = await Produto.findById(item.produtoId);
        const variacao = produto?.variacoes.id(item.variacaoId);
        if (variacao) {
          variacao.estoque = Math.max(0, variacao.estoque - item.quantidade);
          await produto.save();
        }
      }

      if (pedido.cupom?.codigo) {
        await Cupom.updateOne({ guildId: interaction.guild.id, codigo: pedido.cupom.codigo }, { $inc: { usos: 1 } });
      }

      pedido.status = 'pago';
      pedido.pagoEm = new Date();
      pedido.confirmadoPor = interaction.user.id;
      await pedido.save();

      const personalizacaoConfirmar = await obterPersonalizacao(interaction.guild.id);
      const linhaConfirmada = new ActionRowBuilder().addComponents(
        aplicarEmoji(new ButtonBuilder().setCustomId('confirmado').setLabel(`Confirmado por ${interaction.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true), 'confirmado', personalizacaoConfirmar)
      );
      await interaction.update({ components: [linhaConfirmada] });

      const { totalFinal, desconto } = calcularTotais(pedido);
      const embed = new EmbedBuilder().setColor(0x57f287);
      aplicarEmbedChrome(embed, 'pagamentoConfirmado', personalizacaoConfirmar);
      embed.setDescription(
        `Seu pagamento de **${formatarReal(totalFinal)}** foi confirmado por <@${interaction.user.id}>.\n\n` +
        'Um atendente vai te entregar o(s) produto(s) por aqui. Obrigado pela compra! 🎉'
      );
      await interaction.channel.send({ content: `<@${pedido.userId}>`, embeds: [embed] });

      if (cfg?.canalLogsId) {
        const canalLog = await client.channels.fetch(cfg.canalLogsId).catch(() => null);
        if (canalLog) {
          canalLog.send({ embeds: [montarEmbedEntrega(pedido, totalFinal, pedido.pagoEm, personalizacaoConfirmar)] });
        }
      }

      if (cfg?.canalEntregasId) {
        await publicarCompraAprovada(client, pedido, {
          canalEntregasId: cfg.canalEntregasId,
          totalFinal,
          desconto,
          personalizacao: personalizacaoConfirmar,
        });
      }

      // O carrinho é apagado 10 segundos depois da confirmação do staff.
      await fecharCanalCarrinho(client, pedido.threadId, 'Compra confirmada', 10000);
      return;
    }

    if (acao === 'cancelarpg') {
      const pedido = await buscarPedido(resto);
      const cfg = await Config.findOne({ guildId: interaction.guild.id });
      const ehDono = !!pedido && String(pedido.userId) === interaction.user.id;

      if (!ehStaff(interaction, cfg) && !ehDono) {
        return interaction.reply({ content: '❌ Só a equipe pode cancelar pedidos.', ephemeral: true });
      }
      if (!pedido || pedido.status !== 'pagamento') {
        return interaction.reply({ content: '⚠️ Esse pedido já não está mais pendente.', ephemeral: true });
      }

      pedido.status = 'cancelado';
      await pedido.save();

      const personalizacaoCancelar = await obterPersonalizacao(interaction.guild.id);
      const linhaCancelada = new ActionRowBuilder().addComponents(
        aplicarEmoji(new ButtonBuilder().setCustomId('cancelado').setLabel(`Cancelado por ${interaction.user.username}`).setStyle(ButtonStyle.Danger).setDisabled(true), 'cancelado', personalizacaoCancelar)
      );
      await interaction.update({ components: [linhaCancelada] });
      await interaction.channel.send(`❌ Pedido cancelado por <@${interaction.user.id}>. Este canal será apagado em instantes.`);

      const embedLogCancelPg = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(ehStaff(interaction, cfg) ? '❌ Pagamento cancelado pela equipe' : '❌ Pagamento cancelado pelo cliente')
        .setDescription(`<@${interaction.user.id}> cancelou o pedido de <@${pedido.userId}>.`)
        .addFields(
          { name: 'Pedido', value: `\`${pedido.codigo}\``, inline: true },
          { name: 'Cliente', value: `<@${pedido.userId}>`, inline: true }
        )
        .setTimestamp();
      await registrarLog(client, interaction.guild.id, embedLogCancelPg);

      await fecharCanalCarrinho(client, pedido.threadId, 'Pedido cancelado', 5000);
      return;
    }

    if (acao === 'verificar' && resto === 'membro') {
      return handleVerificarMembro(interaction, client);
    }

    if (acao === 'avisarestoque') {
      const [produtoId, variacaoId] = resto.split(':');
      const produto = await buscarProdutoPorId(produtoId);
      const variacao = produto?.variacoes.id(variacaoId);
      if (!produto || !variacao) {
        return interaction.reply({ content: '❌ Essa opção não existe mais.', ephemeral: true });
      }
      await AvisoEstoque.findOneAndUpdate(
        { variacaoId: variacao._id, userId: interaction.user.id },
        {
          guildId: interaction.guild.id,
          produtoId: produto._id, produtoNome: produto.nome,
          variacaoId: variacao._id, variacaoNome: variacao.nome,
          userId: interaction.user.id,
        },
        { upsert: true }
      );
      return interaction.reply({
        content: `🔔 Combinado! Você será avisado por DM quando **${produto.nome} — ${variacao.nome}** voltar ao estoque.`,
        ephemeral: true,
      });
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('pers_modemoji_')) {
      return salvarEmoji(interaction, interaction.customId.slice('pers_modemoji_'.length));
    }
    if (interaction.customId.startsWith('pers_modembed_')) {
      return salvarEmbed(interaction, interaction.customId.slice('pers_modembed_'.length));
    }

    const [tipo, resto] = splitCustomId(interaction.customId);

    if (tipo === 'pnlmodal') {
      const draft = obterDraft(interaction.guild.id, interaction.user.id);
      if (!draft) return sessaoEditorExpirada(interaction);
      const produto = await produtoDoDraft(draft, interaction.guild.id);

      if (resto === 'nome') {
        const titulo = interaction.fields.getTextInputValue('titulo').trim();
        if (!titulo) {
          return interaction.reply({ content: '⚠️ O nome do painel não pode ficar vazio.', ephemeral: true });
        }
        draft.nome = titulo.slice(0, 256);
        return atualizarEditor(interaction, montarMensagemEditor(draft, produto), '✅ Nome atualizado!');
      }

      if (resto === 'desc') {
        draft.descricao = interaction.fields.getTextInputValue('descricao').trim().slice(0, 4096);
        return atualizarEditor(interaction, montarMensagemEditor(draft, produto), '✅ Descrição atualizada!');
      }

      if (resto === 'estoque') {
        const bruto = interaction.fields.getTextInputValue('quantidade').trim();
        const quantidade = Number(bruto);

        if (!Number.isInteger(quantidade) || quantidade < 0) {
          return interaction.reply({
            content: `❓ \`${bruto}\` não é uma quantidade válida. Digite um número inteiro maior ou igual a 0.`,
            ephemeral: true,
          });
        }
        if (!produto || !draft.variacaoEstoqueId) return sessaoEditorExpirada(interaction);

        const variacao = produto.variacoes.id(draft.variacaoEstoqueId);
        if (!variacao) {
          return interaction.reply({ content: '⚠️ Essa variação não existe mais.', ephemeral: true });
        }

        const nomeVariacao = variacao.nome;
        variacao.estoque = quantidade;
        await produto.save();
        draft.variacaoEstoqueId = null;

        return atualizarEditor(
          interaction,
          montarMensagemEditor(draft, produto),
          `✅ Estoque de **${produto.nome} — ${nomeVariacao}** atualizado para **${quantidade}**.`
        );
      }
    }

    if (tipo === 'modalqtd') {
      const [pedidoId, itemId] = resto.split('_');
      const bruto = interaction.fields.getTextInputValue('quantidade').trim();
      const quantidade = Number(bruto);

      if (!Number.isInteger(quantidade) || quantidade < 0) {
        return interaction.reply({
          content:
            `❓ A quantidade \`${bruto}\` não é um número inteiro válido ou é menor que zero, tente novamente.\n` +
            'ℹ️ Certifique-se de digitar apenas números inteiros (ex: 1, 2, 3). Use `0` para remover o item.',
          ephemeral: true,
        });
      }

      const pedido = await buscarPedido(pedidoId);
      if (!pedido) return interaction.reply({ content: '⚠️ Carrinho não encontrado.', ephemeral: true });

      const item = pedido.itens.id(itemId);
      if (!item) return interaction.reply({ content: '⚠️ Esse item não existe mais no carrinho.', ephemeral: true });

      if (quantidade === 0) item.deleteOne();
      else item.quantidade = quantidade;
      pedido.status = 'carrinho';
      await pedido.save();

      const canal = await client.channels.fetch(pedido.threadId).catch(() => null);
      if (canal && pedido.mensagemRevisaoId) {
        const produtos = await Produto.find({ guildId: pedido.guildId, ativo: true });
        aplicarImagensItens(pedido, produtos);
        const opcoesAddItem = construirOpcoesTodasVariacoes(produtos);
        const personalizacaoQtd = await obterPersonalizacao(pedido.guildId);
        const msg = await canal.messages.fetch(pedido.mensagemRevisaoId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [montarEmbedRevisao(pedido, personalizacaoQtd)],
            components: montarComponentesRevisao(pedido, opcoesAddItem, personalizacaoQtd),
          });
        }
      }
      return interaction.reply({ content: '✅ Quantidade atualizada.', ephemeral: true });
    }

    if (tipo === 'modalcupom') {
      const pedidoId = resto;
      const codigo = interaction.fields.getTextInputValue('codigo').trim().toUpperCase();

      const pedido = await buscarPedido(pedidoId);
      if (!pedido) return interaction.reply({ content: '⚠️ Carrinho não encontrado.', ephemeral: true });

      const cupom = await Cupom.findOne({ guildId: interaction.guild.id, codigo, ativo: true });
      if (!cupom) {
        return interaction.reply({ content: `❌ Cupom \`${codigo}\` inválido ou expirado.`, ephemeral: true });
      }
      if (cupom.usosMax > 0 && cupom.usos >= cupom.usosMax) {
        return interaction.reply({ content: `❌ Cupom \`${codigo}\` já atingiu o limite de usos.`, ephemeral: true });
      }

      pedido.cupom = { codigo: cupom.codigo, tipo: cupom.tipo, valor: cupom.valor };
      pedido.status = 'carrinho';
      await pedido.save();

      const canal = await client.channels.fetch(pedido.threadId).catch(() => null);
      if (canal && pedido.mensagemRevisaoId) {
        const produtos = await Produto.find({ guildId: pedido.guildId, ativo: true });
        aplicarImagensItens(pedido, produtos);
        const opcoesAddItem = construirOpcoesTodasVariacoes(produtos);
        const personalizacaoCupom = await obterPersonalizacao(pedido.guildId);
        const msg = await canal.messages.fetch(pedido.mensagemRevisaoId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [montarEmbedRevisao(pedido, personalizacaoCupom)],
            components: montarComponentesRevisao(pedido, opcoesAddItem, personalizacaoCupom),
          });
        }
      }
      return interaction.reply({ content: `✅ Cupom \`${codigo}\` aplicado!`, ephemeral: true });
    }
  }
}

async function adicionarDoPainel(interaction, client, produtoId, variacaoId) {
  const produto = await buscarProdutoDaGuild(produtoId, interaction.guild.id);
  const variacao = produto?.variacoes.id(variacaoId);

  if (!produto || !variacao) {
    return interaction.reply({ content: '❌ Essa opção não existe mais.', ephemeral: true });
  }

  const personalizacaoOpcoes = await obterPersonalizacao(interaction.guild.id);

  if (variacao.estoque <= 0) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(`Este produto teve o seu estoque esgotado.\n**${produto.nome} — ${variacao.nome}**`);
    const linha = new ActionRowBuilder().addComponents(
      aplicarEmoji(
        new ButtonBuilder()
          .setCustomId(`avisarestoque_${produto._id}:${variacao._id}`)
          .setLabel('Avisar quando o estoque voltar')
          .setStyle(ButtonStyle.Secondary),
        'avisarestoque',
        personalizacaoOpcoes
      )
    );
    return interaction.reply({ embeds: [embed], components: [linha], ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  let pedido = await obterPedidoAberto(interaction.guild.id, interaction.user.id);
  let canal;
  let criado = false;

  if (pedido) {
    canal = await client.channels.fetch(pedido.threadId).catch(() => null);

    // Carrinho antigo que ainda é um CANAL (criado antes da mudança para tópicos):
    // cancela e apaga para que um novo carrinho seja aberto como tópico.
    if (canal && !canal.isThread?.()) {
      pedido.status = 'cancelado';
      await pedido.save();
      await fecharCanalCarrinho(client, canal.id, 'Carrinho antigo substituído por tópico', 1000);
      pedido = null;
      canal = null;
    }
  }

  if (!pedido || !canal) {
    canal = await criarCanalCarrinho(interaction);
    pedido = new Pedido({
      codigo: await novoCodigoPedidoUnico(),
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      username: interaction.user.username,
      threadId: canal.id,
      canalPainelId: interaction.channel.id,
      status: 'carrinho',
    });
    criado = true;
  } else if (pedido.status === 'pagamento') {
    pedido.status = 'carrinho';
  }

  adicionarItemAoPedido(pedido, produto, variacao);
  await pedido.save();

  const produtos = await Produto.find({ guildId: interaction.guild.id, ativo: true });
  aplicarImagensItens(pedido, produtos);
  const opcoesAddItem = construirOpcoesTodasVariacoes(produtos);
  const msg = await canal.send({
    content: `<@${pedido.userId}>`,
    embeds: [montarEmbedRevisao(pedido, personalizacaoOpcoes)],
    components: montarComponentesRevisao(pedido, opcoesAddItem, personalizacaoOpcoes),
  });

  if (pedido.mensagemRevisaoId && pedido.mensagemRevisaoId !== msg.id) {
    const antiga = await canal.messages.fetch(pedido.mensagemRevisaoId).catch(() => null);
    if (antiga) await antiga.delete().catch(() => null);
  }
  pedido.mensagemRevisaoId = msg.id;
  await pedido.save();

  const urlCanal = `https://discord.com/channels/${interaction.guild.id}/${canal.id}`;
  const linhaLink = new ActionRowBuilder().addComponents(
    aplicarEmoji(
      new ButtonBuilder().setLabel('Ir para o carrinho').setStyle(ButtonStyle.Link).setURL(urlCanal),
      'ircarrinho',
      personalizacaoOpcoes
    )
  );

  await interaction.editReply({
    content: criado ? '✅ | Seu carrinho foi criado com êxito.' : '✅ | Item adicionado ao seu carrinho.',
    components: [linhaLink],
  });

  if (criado) {
    const embedLog = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🛒 Carrinho aberto')
      .setDescription(`<@${pedido.userId}> abriu um novo carrinho.`)
      .addFields(
        { name: 'Pedido', value: `\`${pedido.codigo}\``, inline: true },
        { name: 'Cliente', value: `<@${pedido.userId}>`, inline: true },
        { name: 'Canal', value: `<#${canal.id}>`, inline: true }
      )
      .setTimestamp();
    await registrarLog(client, interaction.guild.id, embedLog);
  }
}

async function produtoDoDraft(draft, guildId) {
  if (!draft?.produtoId) return null;
  return buscarProdutoDaGuild(draft.produtoId, guildId);
}

function sessaoEditorExpirada(interaction) {
  return interaction.reply({
    content: '⚠️ A sessão do editor expirou. Use `/painel-loja` para começar de novo.',
    ephemeral: true,
  });
}

// Resposta de modal do editor: UPDATE_MESSAGE é válido para MODAL_SUBMIT, então
// a própria mensagem efêmera do editor é atualizada com a prévia nova.
async function atualizarEditor(interaction, payload, confirmacao) {
  try {
    return await interaction.update({ ...payload, content: `${payload.content}\n\n${confirmacao}` });
  } catch (err) {
    console.error('⚠️ Não consegui atualizar a mensagem do editor:', err.message);
    return interaction.reply({ content: confirmacao, ephemeral: true });
  }
}

async function handleVerificarMembro(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    
    const config = await Config.findOne({ guildId });
    if (!config?.cargoVerificacaoId) {
      return interaction.editReply({
        content: '❌ O cargo de verificação não está configurado. Peça a um administrador para configurar usando `/config cargo-verificacao`.',
      });
    }
    
    // Verificar se o membro já foi verificado
    const membroJaVerificado = await MembroVerificado.findOne({ guildId, userId });
    if (membroJaVerificado) {
      return interaction.editReply({
        content: '✅ Você já foi verificado anteriormente!',
      });
    }
    
    // Buscar o cargo
    const cargo = await interaction.guild.roles.fetch(config.cargoVerificacaoId);
    if (!cargo) {
      return interaction.editReply({
        content: '❌ O cargo de verificação não existe mais. Peça a um administrador para reconfigurar.',
      });
    }
    
    // Verificar se o membro já tem o cargo
    const membro = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!membro) {
      return interaction.editReply({
        content: '❌ Não foi possível encontrar seu perfil no servidor.',
      });
    }
    
    if (membro.roles.cache.has(cargo.id)) {
      // Se já tem o cargo, só registrar no banco de dados
      await MembroVerificado.findOneAndUpdate(
        { guildId, userId },
        { 
          guildId, 
          userId, 
          cargoVerificacaoId: cargo.id,
          verificadoPor: 'bot' 
        },
        { upsert: true, new: true }
      );
      return interaction.editReply({
        content: `✅ Você já possui o cargo ${cargo}!`,
      });
    }
    
    // Adicionar o cargo
    await membro.roles.add(cargo);
    
    // Registrar no banco de dados
    await MembroVerificado.findOneAndUpdate(
      { guildId, userId },
      { 
        guildId, 
        userId, 
        cargoVerificacaoId: cargo.id,
        verificadoPor: 'bot',
        verificadoEm: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Registrar log (opcional)
    const embedLog = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Membro Verificado')
      .setDescription(`<@${userId}> se verificou usando o botão`)
      .addFields(
        { name: 'Membro', value: `<@${userId}>`, inline: true },
        { name: 'Cargo recebido', value: `${cargo}`, inline: true },
        { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();
    
    if (config.canalLogsId) {
      const canalLog = await client.channels.fetch(config.canalLogsId).catch(() => null);
      if (canalLog) {
        await canalLog.send({ embeds: [embedLog] }).catch(() => null);
      }
    }
    
    return interaction.editReply({
      content: `✅ Verificação concluída com sucesso! Você recebeu o cargo ${cargo} e agora tem acesso aos canais do servidor.`,
    });
    
  } catch (error) {
    console.error('Erro ao verificar membro:', error);
    return interaction.editReply({
      content: `❌ Ocorreu um erro ao processar sua verificação: ${error.message}`,
    });
  }
}

function splitCustomId(customId) {
  const i = customId.indexOf('_');
  if (i === -1) return [customId, ''];
  return [customId.slice(0, i), customId.slice(i + 1)];
}

async function abrirModalQuantidade(interaction, pedidoId, itemId) {
  const modal = new ModalBuilder().setCustomId(`modalqtd_${pedidoId}_${itemId}`).setTitle('Alterar Quantidade');
  const input = new TextInputBuilder()
    .setCustomId('quantidade').setLabel('Quantidade').setStyle(TextInputStyle.Short)
    .setRequired(true).setPlaceholder('Insira a quantia que deseja, ex: 2 (ou 0 para remover)');
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}
