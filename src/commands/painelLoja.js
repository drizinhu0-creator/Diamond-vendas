const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const Produto = require('../models/Produto');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel-loja')
    .setDescription('Cria um painel editável da loja neste canal (nome, descrição, produto, estoque, cor)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const produtos = await Produto.find({ guildId: interaction.guild.id, ativo: true });
    if (produtos.length === 0) {
      return interaction.reply({ content: 'Cadastre produtos primeiro com `/produto-add`.', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('paineltipo')
      .setPlaceholder('Como os clientes vão escolher as opções do produto?')
      .addOptions([
        { label: 'Botão', description: 'Um botão de compra para cada variação', value: 'botao' },
        { label: 'Menu de seleção', description: 'Barra suspensa com as variações', value: 'menu' },
      ]);

    await interaction.reply({
      content:
        '🎨 **Novo painel da loja**\n\n' +
        '**1.** Escolha abaixo se o painel vai usar **botão** ou **menu de seleção**.\n' +
        '**2.** Depois edite **nome, descrição, produto, estoque e cor** e confira em **Prévia**.\n' +
        '**3.** Clique em **🚀 Publicar** para o painel aparecer neste canal.',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  },
};
