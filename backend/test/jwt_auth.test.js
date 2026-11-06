const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config/constants');

describe('Autenticação & Token JWT', () => {
  test('deve assinar e decodificar token JWT com sucesso', () => {
    const payload = { id: 'user-123', email: 'teste@syncplay.com', name: 'Tester' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const decoded = jwt.verify(token, JWT_SECRET);
    assert.equal(decoded.id, payload.id);
    assert.equal(decoded.email, payload.email);
    assert.equal(decoded.name, payload.name);
  });

  test('deve rejeitar token assinado com chave secreta diferente', () => {
    const fakeToken = jwt.sign({ id: 'hacker' }, 'WRONG_SECRET_KEY');

    assert.throws(
      () => {
        jwt.verify(fakeToken, JWT_SECRET);
      },
      { name: 'JsonWebTokenError' }
    );
  });

  test('deve rejeitar token expirado', () => {
    const expiredToken = jwt.sign({ id: 'expired' }, JWT_SECRET, { expiresIn: -10 });

    assert.throws(
      () => {
        jwt.verify(expiredToken, JWT_SECRET);
      },
      { name: 'TokenExpiredError' }
    );
  });
});

