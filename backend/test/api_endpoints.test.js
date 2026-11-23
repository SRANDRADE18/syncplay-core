const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { authenticateToken } = require('../src/middlewares/auth');
const authController = require('../src/controllers/authController');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config/constants');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
  };
}

describe('Controllers & Middlewares HTTP', () => {
  test('authenticateToken deve bloquear requisição sem cabeçalho Authorization com 401', () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.error, 'Token de autenticação não fornecido.');
    assert.equal(nextCalled, false);
  });

  test('authenticateToken deve bloquear requisição com token corrompido ou inválido com 403', () => {
    const req = {
      headers: {
        authorization: 'Bearer token_invalido_123',
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, 'Token inválido ou expirado.');
    assert.equal(nextCalled, false);
  });

  test('authenticateToken deve autorizar e anexar req.user quando o token for válido', () => {
    const userPayload = { id: 'usr-1', email: 'teste@syncplay.com', name: 'UsuarioTeste' };
    const validToken = jwt.sign(userPayload, JWT_SECRET);

    const req = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user?.id, userPayload.id);
    assert.equal(req.user?.email, userPayload.email);
  });

  test('login deve retornar 400 se email ou senha não forem informados', async () => {
    const req = { body: {} };
    const res = createMockRes();

    await authController.login(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Email e senha são obrigatórios.');
  });

  test('register deve retornar 400 se email ou senha não forem informados', async () => {
    const req = { body: { name: 'Sem Senha' }, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    const res = createMockRes();

    await authController.register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Email e senha são obrigatórios.');
  });
});
