const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Produto = require('../models/Produto');
const { normalizarEmoji } = require('../personalizacao');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-add')
    .setDescription('Cria um novo produto na loja (depois adicione variações com /produto-variacao-add)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('nome').setDescription('Nome do produto').setRequired(true))
    .addStringOption((opt) => opt.setName('descricao').setDescription('Descrição do produto').setRequired(false))
    .addStringOption((opt) =>
      opt
        .setName('emoji')
        .setDescription('Emoji que fica à esquerda do nome da variação no menu (ex: 🔥 ou <:nome:id>)')
        .setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt.setName('imagem').setDescription('Envie a imagem/banner do produto (anexar arquivo)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('imagem-url').setDescription('Ou, em vez de anexar, cole a URL de uma imagem').setRequired(false)
    ),

  async execute(interaction) {
    const nome = interaction.options.getString('nome');
    const descricao = interaction.options.getString('descricao') || 'Sem descrição';
    const emojiBruto = interaction.options.getString('emoji');
    const anexo = interaction.options.getAttachment('imagem');
    const imagemUrl = interaction.options.getString('imagem-url');

    if (emojiBruto !== null && !normalizarEmoji(emojiBruto)) {
      return interaction.reply({
        content: '❌ Não reconheci esse emoji. Use um emoji comum (ex: 🔥) ou um emoji do servidor (`<:nome:id>`).',
        ephemeral: true,
      });
    }

    if (anexo && !anexo.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '❌ O arquivo enviado não é uma imagem.', ephemeral: true });
    }

    const imagem = anexo?.url || imagemUrl || null;

    const produto = await Produto.create({
      guildId: interaction.guild.id,
      nome,
      descricao,
      ...(emojiBruto !== null ? { emoji: normalizarEmoji(emojiBruto) } : {}),
      imagemUrl: imagem,
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Produto criado')
      .setColor(0x57f287)
      .addFields(
        { name: 'ID', value: String(produto._id), inline: false },
        { name: 'Nome', value: nome, inline: true }
      )
      .setDescription('Agora adicione pelo menos uma variação com `/produto-variacao-add`.');
    if (produto.emoji) embed.addFields({ name: 'Emoji', value: produto.emoji, inline: true });
    if (imagem) embed.setThumbnail(imagem);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
