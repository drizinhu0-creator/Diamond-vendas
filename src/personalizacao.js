const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const Personalizacao = require('./models/Personalizacao');
const { BOTOES, EMBEDS, buscarBotao, buscarEmbed } = require('./registroPersonalizacao');

// ---------------------------------------------------------------------------
// Leitura / aplicação das personalizações (usado ao montar botões e embeds)
// ---------------------------------------------------------------------------

async function obterPersonalizacao(guildId) {
  const doc = await Personalizacao.findOne({ guildId });
  return doc || { botoes: new Map(), embeds: new Map() };
}

function valorMapa(mapa, chave) {
  if (!mapa) return undefined;
  if (typeof mapa.get === 'function') return mapa.get(chave);
  return mapa[chave];
}

function emojiBotao(personalizacao, chave) {
  const custom = valorMapa(personalizacao?.botoes, chave);
  return custom?.emoji || buscarBotao(chave)?.emojiPadrao || undefined;
}

// Aplica o emoji (personalizado ou padrão) num ButtonBuilder
function aplicarEmoji(builder, chave, personalizacao) {
  const emoji = emojiBotao(personalizacao, chave);
  if (emoji) builder.setEmoji(emoji);
  return builder;
}

function tituloEmbed(personalizacao, chave, variaveis = {}) {
  const custom = valorMapa(personalizacao?.embeds, chave);
  const item = buscarEmbed(chave);
  let texto = custom?.titulo || item?.tituloPadrao || '';
  for (const [nomeVar, valor] of Object.entries(variaveis)) {
    texto = texto.split(`{${nomeVar}}`).join(valor);
  }
  return texto;
}

function corEmbed(personalizacao, chave) {
  const custom = valorMapa(personalizacao?.embeds, chave);
  const item = buscarEmbed(chave);
  const hex = (custom?.cor || item?.corPadrao || '').replace('#', '');
  const numero = parseInt(hex, 16);
  return Number.isNaN(numero) ? undefined : numero;
}

// Aplica título (com variáveis substituídas) e cor (personalizados ou padrão) numa EmbedBuilder
function aplicarEmbedChrome(embed, chave, personalizacao, variaveis = {}) {
  embed.setTitle(tituloEmbed(personalizacao, chave, variaveis));
  const cor = corEmbed(personalizacao, chave);
  if (cor !== undefined) embed.setColor(cor);
  return embed;
}

// ---------------------------------------------------------------------------
// Interface do comando /personalizar
// ---------------------------------------------------------------------------

function montarPainelPrincipal() {
  const embed = new EmbedBuilder()
    .setTitle('🎨 Personalizar o Bot')
    .setColor(0x9b59b6)
    .setDescription(
      'Escolha o que deseja personalizar:\n\n' +
        '🙂 **Emoji dos Botões** — troca o emoji de qualquer botão já cadastrado no bot.\n' +
        '🖼️ **Título/Cor das Embeds** — troca o título e a cor de qualquer embed já cadastrada no bot.'
    );

  const linha = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pers_abriremoji').setLabel('Emoji dos Botões').setEmoji('🙂').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('pers_abrirembed').setLabel('Título/Cor das Embeds').setEmoji('🖼️').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [linha] };
}

function emojiParaOpcao(emoji) {
  if (!emoji) return undefined;
  const m = emoji.match(/^<a?:(\w+):(\d+)>$/);
  if (m) return { id: m[2], name: m[1] };
  return emoji;
}

async function abrirSeletorEmoji(interaction) {
  const personalizacao = await obterPersonalizacao(interaction.guild.id);

  const opcoes = BOTOES.map((b) => {
    const atual = emojiBotao(personalizacao, b.chave);
    return {
      label: b.nome.slice(0, 100),
      description: `Emoji atual: ${atual || '(nenhum)'}`.slice(0, 100),
      value: b.chave,
      emoji: emojiParaOpcao(atual),
    };
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('pers_selemoji')
    .setPlaceholder('Selecione o botão que deseja editar')
    .addOptions(opcoes);

  return interaction.reply({
    content: 'Qual botão do bot você quer editar o emoji? (são todos os botões já cadastrados)',
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true,
  });
}

function valoresExemplo(item) {
  const exemplo = {};
  if (item.variaveis.includes('usuario')) exemplo.usuario = 'usuário';
  if (item.variaveis.includes('codigo')) exemplo.codigo = 'PED-XXXX';
  return exemplo;
}

async function abrirSeletorEmbed(interaction) {
  const personalizacao = await obterPersonalizacao(interaction.guild.id);

  const opcoes = EMBEDS.map((e) => ({
    label: e.nome.slice(0, 100),
    description: `Título atual: ${tituloEmbed(personalizacao, e.chave, valoresExemplo(e))}`.slice(0, 100),
    value: e.chave,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('pers_selembed')
    .setPlaceholder('Selecione a embed que deseja editar')
    .addOptions(opcoes);

  return interaction.reply({
    content: 'Qual embed do bot você quer editar (título e cor)? (são todas as embeds já cadastradas)',
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true,
  });
}

async function abrirModalEmoji(interaction, chave) {
  const item = buscarBotao(chave);
  if (!item) return interaction.reply({ content: '❌ Botão não encontrado.', ephemeral: true });

  const personalizacao = await obterPersonalizacao(interaction.guild.id);
  const atual = emojiBotao(personalizacao, chave) || '';

  const modal = new ModalBuilder().setCustomId(`pers_modemoji_${chave}`).setTitle(`Emoji — ${item.nome}`.slice(0, 45));
  const input = new TextInputBuilder()
    .setCustomId('emoji')
    .setLabel('Novo emoji')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Digite : para escolher, inclusive emojis do servidor')
    .setValue(atual);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function abrirModalEmbed(interaction, chave) {
  const item = buscarEmbed(chave);
  if (!item) return interaction.reply({ content: '❌ Embed não encontrada.', ephemeral: true });

  const personalizacao = await obterPersonalizacao(interaction.guild.id);
  const custom = valorMapa(personalizacao?.embeds, chave);

  const modal = new ModalBuilder().setCustomId(`pers_modembed_${chave}`).setTitle(`Embed — ${item.nome}`.slice(0, 45));

  const inputTitulo = new TextInputBuilder()
    .setCustomId('titulo')
    .setLabel('Título')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200)
    .setValue(custom?.titulo || item.tituloPadrao)
    .setPlaceholder(item.variaveis.length ? `Pode usar: ${item.variaveis.map((v) => `{${v}}`).join(', ')}` : 'Título da embed');

  const inputCor = new TextInputBuilder()
    .setCustomId('cor')
    .setLabel('Cor (hex, ex: 9B59B6)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(7)
    .setValue(custom?.cor || item.corPadrao);

  modal.addComponents(new ActionRowBuilder().addComponents(inputTitulo), new ActionRowBuilder().addComponents(inputCor));
  return interaction.showModal(modal);
}

function normalizarEmoji(bruto) {
  if (!bruto) return null;
  const texto = bruto.trim();
  if (/^<a?:\w+:\d+>$/.test(texto)) return texto; // emoji do servidor (custom)
  if (texto.length > 0 && texto.length <= 8) return texto; // emoji unicode
  return null;
}

async function salvarEmoji(interaction, chave) {
  const item = buscarBotao(chave);
  if (!item) return interaction.reply({ content: '❌ Botão não encontrado.', ephemeral: true });

  const bruto = interaction.fields.getTextInputValue('emoji').trim();
  const emoji = normalizarEmoji(bruto);
  if (!emoji) {
    return interaction.reply({
      content: '❌ Não reconheci esse emoji. Digite um emoji comum ou escolha um emoji do servidor (aparece ao digitar `:`).',
      ephemeral: true,
    });
  }

  const doc = (await Personalizacao.findOne({ guildId: interaction.guild.id })) || new Personalizacao({ guildId: interaction.guild.id });
  doc.botoes.set(chave, { emoji });
  await doc.save();

  return interaction.reply({ content: `✅ Emoji do botão **${item.nome}** atualizado para ${emoji}.`, ephemeral: true });
}

async function salvarEmbed(interaction, chave) {
  const item = buscarEmbed(chave);
  if (!item) return interaction.reply({ content: '❌ Embed não encontrada.', ephemeral: true });

  const titulo = interaction.fields.getTextInputValue('titulo').trim();
  const cor = interaction.fields.getTextInputValue('cor').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cor)) {
    return interaction.reply({ content: '❌ Cor inválida. Use um código hex de 6 dígitos, ex: `9B59B6`.', ephemeral: true });
  }
  if (!titulo) {
    return interaction.reply({ content: '❌ O título não pode ficar vazio.', ephemeral: true });
  }

  const doc = (await Personalizacao.findOne({ guildId: interaction.guild.id })) || new Personalizacao({ guildId: interaction.guild.id });
  doc.embeds.set(chave, { titulo, cor });
  await doc.save();

  return interaction.reply({ content: `✅ Embed **${item.nome}** atualizada!`, ephemeral: true });
}

module.exports = {
  obterPersonalizacao,
  emojiBotao,
  aplicarEmoji,
  tituloEmbed,
  corEmbed,
  aplicarEmbedChrome,
  montarPainelPrincipal,
  abrirSeletorEmoji,
  abrirSeletorEmbed,
  abrirModalEmoji,
  abrirModalEmbed,
  salvarEmoji,
  salvarEmbed,
  normalizarEmoji,
};
