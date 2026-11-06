const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticateToken } = require('../middlewares/auth');

// Todas as rotas de gerenciamento de salas exigem token JWT
router.use(authenticateToken);

router.get('/', roomController.listRooms);
router.get('/:id', roomController.getRoomById);
router.post('/', roomController.createRoom);
router.delete('/:id', roomController.deleteRoom);

module.exports = router;

