import { Router } from 'express';
import {
  createUser,
  listUsers,
  updateUserRole,
  updateUserStatus,
} from '../controllers/userController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createAdminUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userListQuerySchema,
} from '../validators/authValidator.js';

const router = Router();

router.get('/', validateRequest(userListQuerySchema, 'query'), listUsers);
router.post('/', validateRequest(createAdminUserSchema), createUser);
router.patch('/:id/role', validateRequest(updateUserRoleSchema), updateUserRole);
router.patch('/:id/status', validateRequest(updateUserStatusSchema), updateUserStatus);

export { router as userRouter };
