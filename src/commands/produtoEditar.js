const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Produto = require('../models/Produto');
const { autocompleteProduto } = require('../autocomplete');
const { normalizarEmoji } = require('../personalizacao');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-editar')
    .setDescription('Edita nome, descrição, emoji, imagem ou status de um produto')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('produto').setDescription('Produto').setRequired(true).setAutocomplete(true))
    .addStringOption((opt) => opt.setName('nome').setDescription('Novo nome').setRequired(false))
    .addStringOption((opt) => opt.setName('descricao').setDescription('Nova descrição').setRequired(false))
    .addStringOption((opt) =>
      opt
        .setName('emoji')
        .setDescription('Novo emoji do menu (use "nenhum" para remover)')
        .setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt.setName('imagem').setDescription('Envie a nova imagem/banner (anexar arquivo)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('imagem-url').setDescription('Ou, em vez de anexar, cole a URL de uma imagem').setRequired(false)
    )
    .addBooleanOption((opt) => opt.setName('ativo').setDescription('Produto visível na loja?').setRequired(false)),

  async autocomplete(interaction) {
    await autocompleteProduto(interaction);
  },

  async execute(interaction) {
    const produtoId = interaction.options.getString('produto');
    const produto = await Produto.findOne({ _id: produtoId, guildId: interaction.guild.id });
    if (!produto) {
      return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
    }

    const nome = interaction.options.getString('nome');
    const descricao = interaction.options.getString('descricao');
    const emojiBruto = interaction.options.getString('emoji');
    const anexo = interaction.options.getAttachment('imagem');
    const imagemUrl = interaction.options.getString('imagem-url');
    const ativo = interaction.options.getBoolean('ativo');

    if (anexo && !anexo.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '❌ O arquivo enviado não é uma imagem.', ephemeral: true });
    }

    if (emojiBruto !== null) {
      if (['nenhum', 'none', 'remover', '-'].includes(emojiBruto.trim().toLowerCase())) {
        produto.emoji = undefined;
      } else {
        const emoji = normalizarEmoji(emojiBruto);
        if (!emoji) {
          return interaction.reply({
            content:
              '❌ Não reconheci esse emoji. Use um emoji comum (ex: 🔥), um emoji do servidor (`<:nome:id>`) ou "nenhum" para remover.',
            ephemeral: true,
          });
        }
        produto.emoji = emoji;
      }
    }

    if (nome !== null) produto.nome = nome;
    if (descricao !== null) produto.descricao = descricao;
    if (anexo) produto.imagemUrl = anexo.url;
    else if (imagemUrl !== null) produto.imagemUrl = imagemUrl;
    if (ativo !== null) produto.ativo = ativo;
    await produto.save();

    await interaction.reply({ content: `✅ Produto **${produto.nome}** atualizado.`, ephemeral: true });
  },
};
