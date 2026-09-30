const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Cupom = require('../models/Cupom');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cupom-add')
    .setDescription('Cria um cupom de desconto')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('codigo').setDescription('Código do cupom (ex: BEMVINDO10)').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('tipo')
        .setDescription('Tipo de desconto')
        .setRequired(true)
        .addChoices({ name: 'Percentual (%)', value: 'percentual' }, { name: 'Fixo (R$)', value: 'fixo' })
    )
    .addNumberOption((opt) => opt.setName('valor').setDescription('Valor do desconto').setRequired(true))
    .addIntegerOption((opt) => opt.setName('usos-max').setDescription('Máximo de usos (0 = ilimitado)').setRequired(false)),

  async execute(interaction) {
    const codigo = interaction.options.getString('codigo').toUpperCase().trim();
    const tipo = interaction.options.getString('tipo');
    const valor = interaction.options.getNumber('valor');
    const usosMax = interaction.options.getInteger('usos-max') ?? 0;

    const existente = await Cupom.findOne({ guildId: interaction.guild.id, codigo });
    if (existente) {
      return interaction.reply({ content: `❌ Já existe um cupom \`${codigo}\`.`, ephemeral: true });
    }

    await Cupom.create({ guildId: interaction.guild.id, codigo, tipo, valor, usosMax });

    const descricaoValor = tipo === 'percentual' ? `${valor}%` : `R$ ${valor.toFixed(2)}`;
    await interaction.reply({
      content: `✅ Cupom \`${codigo}\` criado: **${descricaoValor}** de desconto${usosMax > 0 ? ` (máx. ${usosMax} usos)` : ''}.`,
      ephemeral: true,
    });
  },
};
