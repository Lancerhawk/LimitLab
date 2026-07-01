import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';

const router = Router();

router.get('/', ClientController.getAll);
router.post('/', ClientController.create);
router.get('/:id', ClientController.getById);
router.put('/:id', ClientController.update);
router.delete('/:id', ClientController.delete);

export default router;
