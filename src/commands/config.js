const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Config = require('../models/Config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura o bot de vendas neste servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('canal-logs')
        .setDescription('Define o canal onde as vendas confirmadas serão registradas')
        .addChannelOption((opt) =>
          opt.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cargo-staff')
        .setDescription('Define o cargo que atende os clientes e confirma pagamentos')
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('chave-pix')
        .setDescription('Define a chave Pix usada para gerar as cobranças')
        .addStringOption((opt) =>
          opt.setName('chave').setDescription('Chave Pix (CPF, CNPJ, e-mail, telefone ou chave aleatória)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('nome').setDescription('Nome do recebedor, como aparece no banco (máx. 25 caracteres)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('cidade').setDescription('Cidade do recebedor (máx. 15 caracteres)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cargo-verificacao')
        .setDescription('Define o cargo que será dado aos membros verificados')
        .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo de verificação').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('ver').setDescription('Mostra a configuração atual do servidor')),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    let cfg = await Config.findOne({ guildId });
    if (!cfg) cfg = await Config.create({ guildId });

    if (sub === 'canal-logs') {
      const canal = interaction.options.getChannel('canal');
      cfg.canalLogsId = canal.id;
      await cfg.save();
      return interaction.reply({ content: `✅ Canal de logs definido: ${canal}`, ephemeral: true });
    }

    if (sub === 'cargo-staff') {
      const cargo = interaction.options.getRole('cargo');
      cfg.cargoStaffId = cargo.id;
      await cfg.save();
      return interaction.reply({
        content:
          `✅ Cargo de staff definido: ${cargo}\n` +
          'ℹ️ Os carrinhos viram **canais privados** e esse cargo recebe acesso automaticamente ' +
          'a cada canal criado (o bot precisa da permissão **Gerenciar Canais**).',
        ephemeral: true,
      });
    }

    if (sub === 'chave-pix') {
      const chave = interaction.options.getString('chave').replace(/["'“”‘’`]/g, '').trim();
      const nome = interaction.options.getString('nome');
      const cidade = interaction.options.getString('cidade');
      cfg.chavePix = chave;
      cfg.nomeRecebedor = nome;
      cfg.cidadeRecebedor = cidade;
      await cfg.save();
      return interaction.reply({
        content: `✅ Chave Pix configurada: \`${chave}\` (recebedor: **${nome}**, cidade: **${cidade}**)`,
        ephemeral: true,
      });
    }

    if (sub === 'cargo-verificacao') {
      const cargo = interaction.options.getRole('cargo');
      cfg.cargoVerificacaoId = cargo.id;
      await cfg.save();
      return interaction.reply({
        content: `✅ Cargo de verificação definido: ${cargo}\n` +
                 'Os membros que clicarem no botão de verificação receberão automaticamente este cargo.',
        ephemeral: true,
      });
    }

    if (sub === 'ver') {
      return interaction.reply({
        content: [
          '**Configuração atual:**',
          `Canal de logs: ${cfg.canalLogsId ? `<#${cfg.canalLogsId}>` : 'não definido'}`,
          `Canal de entregas: ${cfg.canalEntregasId ? `<#${cfg.canalEntregasId}>` : 'não definido'}`,
          `Cargo staff: ${cfg.cargoStaffId ? `<@&${cfg.cargoStaffId}>` : 'não definido'}`,
          `Cargo verificação: ${cfg.cargoVerificacaoId ? `<@&${cfg.cargoVerificacaoId}>` : 'não definido'}`,
          `Chave Pix: ${cfg.chavePix ? `\`${cfg.chavePix}\` (${cfg.nomeRecebedor} — ${cfg.cidadeRecebedor})` : 'não definida'}`,
        ].join('\n'),
        ephemeral: true,
      });
    }
  },
};
