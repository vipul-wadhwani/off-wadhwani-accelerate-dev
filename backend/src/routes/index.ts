import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import ventureRoutes from './ventures';
import interactionRoutes from './interactions';
import scheduledCallRoutes from './scheduledCalls';
import adminRoutes from './admin';
import mentorRoutes from './mentor';
import { zoomRoutes } from '../modules/zoom';
import { availabilityRoutes } from '../modules/availability';
import { matchingRoutes } from '../modules/expertMatching';
import { requestRoutes } from '../modules/meetingRequests';
import { briefRoutes } from '../modules/preMeetingBrief';
import { sessionRoutes } from '../modules/liveSession';
const router = Router();

// Mount routes
router.use(healthRoutes); // Mount health directly
router.use('/auth', authRoutes);
router.use('/ventures', ventureRoutes);
router.use('/api', interactionRoutes); // Interactions routes (nested under ventures)
router.use('/scheduled-calls', scheduledCallRoutes);
router.use('/admin', adminRoutes);
router.use('/mentor', mentorRoutes);
router.use('/zoom', zoomRoutes);
router.use('/availability', availabilityRoutes);
router.use('/matching', matchingRoutes);
router.use('/meeting-requests', requestRoutes);
router.use('/briefs', briefRoutes);
router.use('/sessions', sessionRoutes);

// Dev-only: AI Test Framework (no DB writes, not available in production)
if (process.env.ENABLE_TEST_FRAMEWORK === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { testFrameworkRoutes } = require('../modules/testFramework');
    router.use('/test-framework', testFrameworkRoutes);
}

export default router;
