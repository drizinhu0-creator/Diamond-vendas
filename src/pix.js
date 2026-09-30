

function removerAcentos(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizarTexto(texto, max) {
  return removerAcentos(texto)
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, max)
    .toUpperCase();
}

function sanitizarTxid(texto, max = 25) {
  const limpo = removerAcentos(texto)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, max);
  return limpo || '***';
}

function tlv(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function gerarPayloadPix({ chave, nome, cidade, valor, txid }) {
  const chaveTratada = String(chave || '').replace(/["'“”‘’`]/g, '').trim();
  const nomeTratado = sanitizarTexto(nome, 25) || 'RECEBEDOR';
  const cidadeTratada = sanitizarTexto(cidade, 15) || 'BRASIL';
  const txidTratado = sanitizarTxid(txid);

  const infoConta = tlv('00', 'br.gov.bcb.pix') + tlv('01', chaveTratada);
  const dadosAdicionais = tlv('05', txidTratado);

  let payload =
    tlv('00', '01') +
    tlv('01', '11') +
    tlv('26', infoConta) +
    tlv('52', '0000') +
    tlv('53', '986');

  if (valor) {
    payload += tlv('54', Number(valor).toFixed(2));
  }

  payload +=
    tlv('58', 'BR') +
    tlv('59', nomeTratado) +
    tlv('60', cidadeTratada) +
    tlv('62', dadosAdicionais) +
    '6304';

  return payload + crc16(payload);
}

module.exports = { gerarPayloadPix };
