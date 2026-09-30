const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Config = require('../models/Config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('entregas')
    .setDescription('Configura o canal onde as compras aprovadas são publicadas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('canal')
        .setDescription('Canal de entregas (deixe em branco para ver a configuração atual)')
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');

    let cfg = await Config.findOne({ guildId: interaction.guild.id });
    if (!cfg) cfg = await Config.create({ guildId: interaction.guild.id });

    if (!canal) {
      return interaction.reply({
        content: cfg.canalEntregasId
          ? `📦 Canal de entregas atual: <#${cfg.canalEntregasId}>\nℹ️ Use \`/entregas canal:<canal>\` para mudar.`
          : '⚠️ Nenhum canal de entregas configurado.\nℹ️ Use `/entregas canal:<canal>` para definir onde a embed **Compra Aprovada** será publicada.',
        ephemeral: true,
      });
    }

    cfg.canalEntregasId = canal.id;
    await cfg.save();

    return interaction.reply({
      content:
        `✅ Canal de entregas definido: ${canal}\n` +
        'ℹ️ Assim que um atendente confirmar um pagamento, a embed **Compra Aprovada** ' +
        'será publicada nesse canal marcando o comprador, e o canal do carrinho será apagado em 10 segundos.',
      ephemeral: true,
    });
  },
};
