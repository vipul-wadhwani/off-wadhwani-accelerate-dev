import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import ventureRoutes from './ventures';
import interactionRoutes from './interactions';
import scheduledCallRoutes from './scheduledCalls';
import adminRoutes from './admin';

const router = Router();

// Mount routes
router.use(healthRoutes); // Mount health directly
router.use('/auth', authRoutes);
router.use('/ventures', ventureRoutes);
router.use('/api', interactionRoutes); // Interactions routes (nested under ventures)
router.use('/scheduled-calls', scheduledCallRoutes);
router.use('/admin', adminRoutes);

export default router;
