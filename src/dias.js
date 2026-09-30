const DiasServidor = require('./models/DiasServidor');
const { ehDono } = require('./tirar');

// Controle de permanência do bot em cada servidor (`!dia` / `/ver-dias`).
// O prazo fica salvo no Mongo (sobrevive a restarts) e o monitor abaixo
// faz o bot sair sozinho quando o prazo vence.

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const MAX_DIAS = 3650;

function formatarTempo(ms) {
  if (ms <= 0) return 'prazo encerrado';
  const dias = Math.floor(ms / UM_DIA_MS);
  const horas = Math.floor((ms % UM_DIA_MS) / 3600000);
  const minutos = Math.floor((ms % 3600000) / 60000);
  const partes = [];
  if (dias) partes.push(`${dias} dia(s)`);
  if (horas) partes.push(`${horas} hora(s)`);
  if (minutos) partes.push(`${minutos} minuto(s)`);
  if (!partes.length) partes.push('menos de 1 minuto');
  return partes.join(', ');
}

function formatarData(data) {
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function configurarDias(guildId, dias) {
  const agora = new Date();
  const sairEm = new Date(agora.getTime() + dias * UM_DIA_MS);
  return DiasServidor.findOneAndUpdate(
    { guildId },
    { $set: { dias, inicioEm: agora, sairEm } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function buscarPrazo(guildId) {
  return DiasServidor.findOne({ guildId });
}

async function removerPrazo(guildId) {
  const res = await DiasServidor.deleteOne({ guildId });
  return res.deletedCount > 0;
}

// Varre os prazos vencidos e faz o bot sair dos servidores correspondentes.
// Roda a cada minuto (e uma vez na largada) para não depender de setTimeout longos.
let monitorAtivo = false;
function iniciarMonitoramentoDias(client) {
  if (monitorAtivo) return;
  monitorAtivo = true;

  const checar = async () => {
    try {
      const vencidos = await DiasServidor.find({ sairEm: { $lte: new Date() } });
      for (const registro of vencidos) {
        const guild =
          client.guilds.cache.get(registro.guildId) ||
          (await client.guilds.fetch(registro.guildId).catch(() => null));

        if (guild) {
          await guild.leave().catch((err) => {
            console.error(`❌ Erro ao sair do servidor ${guild.name} (${guild.id}):`, err.message);
            throw err;
          });
          console.log(`👋 Prazo vencido — saí do servidor ${guild.name} (${guild.id}).`);
        }

        await DiasServidor.deleteOne({ _id: registro._id });
      }
    } catch (err) {
      console.error('❌ Erro no monitoramento de dias:', err.message);
    }
  };

  checar();
  setInterval(checar, 60 * 1000);
}

const USO_DIA =
  '📝 **Como usar:**\n' +
  '`!dia <número de dias> [id do servidor]` — define por quanto tempo fico no servidor.\n' +
  '`!dia off [id do servidor]` — remove o limite (fico nele para sempre).';

async function resolverAlvo(message, client, args) {
  const alvo = args[1];
  if (!alvo) return { guildId: message.guild.id, guild: message.guild };
  if (!/^\d{17,20}$/.test(alvo)) {
    return { erro: USO_DIA + '\n⚠️ O segundo parâmetro precisa ser um **ID de servidor** válido.' };
  }
  const guild = client.guilds.cache.get(alvo) || (await client.guilds.fetch(alvo).catch(() => null));
  if (!guild) return { erro: `❌ Não estou no servidor \`${alvo}\` (ou o ID está errado).` };
  return { guildId: alvo, guild };
}

// `!dia` — chamado pelo messageCreate; somente o dono do bot.
async function tratarDia(message, client, args = []) {
  if (!(await ehDono(client, message.author.id))) {
    return message.reply('❌ Apenas o **dono do bot** pode usar `!dia`.');
  }

  const primeiro = (args[0] || '').toLowerCase();
  if (!primeiro) return message.reply(USO_DIA);

  if (['off', 'remover', 'limpar', 'cancelar'].includes(primeiro)) {
    const alvo = await resolverAlvo(message, client, args);
    if (alvo.erro) return message.reply(alvo.erro);

    const removido = await removerPrazo(alvo.guildId);
    return message.reply(
      removido
        ? `✅ Limite de dias removido de **${alvo.guild.name}** — vou ficar lá indefinidamente.`
        : `ℹ️ **${alvo.guild.name}** não tinha nenhum limite de dias configurado.`
    );
  }

  if (!/^\d+$/.test(primeiro)) return message.reply(USO_DIA);
  const dias = Number.parseInt(primeiro, 10);
  if (dias < 1 || dias > MAX_DIAS) {
    return message.reply(USO_DIA + `\n⚠️ Informe um número inteiro de **1 a ${MAX_DIAS}** dias.`);
  }

  const alvo = await resolverAlvo(message, client, args);
  if (alvo.erro) return message.reply(alvo.erro);

  const registro = await configurarDias(alvo.guildId, dias);

  return message.reply(
    `✅ **Prazo definido para ${alvo.guild.name}**\n` +
      `📅 Dias: **${dias}**\n` +
      `🕐 Início: **${formatarData(registro.inicioEm)}**\n` +
      `🚪 Serei removido desse servidor em **${formatarData(registro.sairEm)}** ` +
      `(daqui a ${formatarTempo(registro.sairEm - Date.now())}).\n\n` +
      'ℹ️ Use `/ver-dias` para conferir o tempo restante.'
  );
}

module.exports = {
  UM_DIA_MS,
  formatarTempo,
  formatarData,
  configurarDias,
  buscarPrazo,
  removerPrazo,
  iniciarMonitoramentoDias,
  tratarDia,
};
