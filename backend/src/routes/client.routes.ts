import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

router.get('/', ClientController.getAll);
router.post('/', requireAdmin, ClientController.create);
router.get('/:id', ClientController.getById);
router.put('/:id', ClientController.update);
router.delete('/:id', requireAdmin, ClientController.delete);

export default router;
