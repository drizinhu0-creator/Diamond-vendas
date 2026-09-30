
const { EmbedBuilder } = require('discord.js');
const Pedido = require('./models/Pedido');
const Config = require('./models/Config');

const TIMEOUT_MS = 30 * 60 * 1000;

function agendarExpiracao(client, pedidoId, canalId) {
  setTimeout(async () => {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido || pedido.status !== 'pagamento') return;

    pedido.status = 'expirado';
    await pedido.save();

    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (canal) {
      canal.send(
        '⏰ Esse pedido expirou sem confirmação de pagamento em 30 minutos. Peça a um atendente para gerar um novo Pix, ou use `/ticket-fechar`.'
      ).catch(() => null);
    }

    // Registra no canal de logs (se configurado).
    try {
      const cfg = await Config.findOne({ guildId: pedido.guildId });
      if (cfg?.canalLogsId) {
        const canalLog = await client.channels.fetch(cfg.canalLogsId).catch(() => null);
        if (canalLog) {
          const embed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle('⏰ Pedido expirado')
            .setDescription(`O pedido de <@${pedido.userId}> expirou sem confirmação de pagamento em 30 minutos.`)
            .addFields(
              { name: 'Pedido', value: `\`${pedido.codigo}\``, inline: true },
              { name: 'Cliente', value: `<@${pedido.userId}>`, inline: true },
              { name: 'Canal', value: canalId ? `<#${canalId}>` : '—', inline: true }
            )
            .setTimestamp();
          await canalLog.send({ embeds: [embed] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error('Erro ao registrar log de expiração:', err);
    }
  }, TIMEOUT_MS);
}

module.exports = { agendarExpiracao };
