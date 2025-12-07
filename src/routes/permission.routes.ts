import { Router } from 'express';
import * as permissionController from '../controllers/permission.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: Get all permissions grouped by role
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions grouped by role
 */
router.get('/', authenticate, isAdmin, permissionController.getAll);

/**
 * @swagger
 * /permissions/me:
 *   get:
 *     summary: Get permissions for the current user
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user's permissions
 */
router.get('/me', authenticate, permissionController.getMyPermissions);

/**
 * @swagger
 * /permissions/{role}:
 *   get:
 *     summary: Get permissions for a specific role
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ADMIN, DOCTOR, SECRETARY]
 *     responses:
 *       200:
 *         description: Role permissions
 */
router.get('/:role', authenticate, isAdmin, permissionController.getByRole);

/**
 * @swagger
 * /permissions/{role}:
 *   put:
 *     summary: Update permissions for a role
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ADMIN, DOCTOR, SECRETARY]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *     responses:
 *       200:
 *         description: Permissions updated
 */
router.put('/:role', authenticate, isAdmin, permissionController.updateRolePermissions);

/**
 * @swagger
 * /permissions/{role}/reset:
 *   post:
 *     summary: Reset permissions to default for a role
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [ADMIN, DOCTOR, SECRETARY]
 *     responses:
 *       200:
 *         description: Permissions reset to default
 */
router.post('/:role/reset', authenticate, isAdmin, permissionController.resetRolePermissions);

export default router;
