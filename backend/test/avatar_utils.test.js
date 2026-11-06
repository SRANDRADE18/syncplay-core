const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getInitials, getUserColor } = require('../src/utils/avatar');
const { DISCORD_AVATAR_GRADIENTS } = require('../src/config/constants');

describe('Avatar & Formatting Utilities', () => {
  test('deve extrair as iniciais de nomes compostos corretamente', () => {
    assert.equal(getInitials('Luna Martins'), 'LM');
    assert.equal(getInitials('João Pedro Silva'), 'JS');
    assert.equal(getInitials('Ana Maria Braga de Souza'), 'AS');
  });

  test('deve extrair 2 primeiras letras para nome simples ou único', () => {
    assert.equal(getInitials('Rafael'), 'RA');
    assert.equal(getInitials('Tiago'), 'TI');
  });

  test('deve retornar "U" como fallback para strings vazias', () => {
    assert.equal(getInitials(''), 'U');
    assert.equal(getInitials('   '), 'U');
  });

  test('deve gerar gradiente consistente e dentro da paleta suportada', () => {
    const color1 = getUserColor('Luna Martins');
    const color2 = getUserColor('Luna Martins');
    assert.equal(color1, color2, 'O hash deve ser puramente determinístico');
    assert.ok(
      DISCORD_AVATAR_GRADIENTS.includes(color1),
      'A cor gerada deve pertencer à paleta pré-definida'
    );
  });
});

