import { getOrSyncCurrentSession } from '../utils/sessionHelper.js';

export const requireOpenSession = async (req, res, next) => {
  try {
    const { session, isOpen, reason } = await getOrSyncCurrentSession();

    if (!isOpen || !session) {
      return res.status(403).json({
        success: false,
        message: reason || 'Business session is currently CLOSED. Transactions are only allowed between 07:00 AM and 07:00 PM PKT when session is OPEN.',
        session: session || null,
        isSessionClosed: true,
      });
    }

    req.businessSession = session;
    req.businessDate = session.businessDate;
    next();
  } catch (error) {
    console.error('[requireOpenSession Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify business session state' });
  }
};

