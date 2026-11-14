import { asyncHandler } from '../utils/asyncHandler.js';
import { userService } from '../services/userService.js';

export const listUsers = asyncHandler(async (req, res) => {
  res.json(await userService.listUsers(req.validated.page, req.validated.limit));
});

export const createUser = asyncHandler(async (req, res) => {
  res.status(201).json(await userService.createUser(req.validated, req.session.user));
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await userService.updateUserRole(req.params.id, req.validated.role, req.session.user);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cuenta no encontrada.' } });
  }
  res.json(user);
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.validated.status, req.session.user);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cuenta no encontrada.' } });
  }
  res.json(user);
});
