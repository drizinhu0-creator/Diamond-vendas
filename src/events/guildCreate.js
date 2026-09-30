module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild, client) {
    const comandos = [...client.commands.values()]
      .filter((cmd) => cmd?.data)
      .map((cmd) => cmd.data.toJSON());

    if (comandos.length === 0) {
      console.log(`⚠️ Nenhum slash command carregado para registrar em "${guild.name}".`);
      return;
    }

    try {
      await client.application.commands.set(comandos, guild.id);
      console.log(
        `🆕 Novo servidor "${guild.name}" (${guild.id}) — ${comandos.length} slash command(s) registrados.`
      );
    } catch (err) {
      console.error(
        `❌ Erro ao registrar slash commands em "${guild.name}" (${guild.id}):`,
        err.message
      );
    }
  },
};
