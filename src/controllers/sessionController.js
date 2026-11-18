import BusinessSession from '../models/BusinessSession.js';
import AuditLog from '../models/AuditLog.js';
import {
  getOrSyncCurrentSession,
  computeSessionTotals,
  calculateTotalCurrentStock,
} from '../utils/sessionHelper.js';
import {
  getNowPKT,
  getCurrentBusinessDate,
  isWithinBusinessHours,
  formatPKT,
} from '../utils/timeHelper.js';

// @desc    Get current business session and server status
// @route   GET /api/sessions/current
export const getCurrentSession = async (req, res) => {
  try {
    const { session, isOpen, reason } = await getOrSyncCurrentSession();
    const now = getNowPKT();
    const currentDate = getCurrentBusinessDate();
    const withinOperatingHours = isWithinBusinessHours();
    const currentStock = await calculateTotalCurrentStock();

    let sessionStats = null;
    if (session) {
      sessionStats = await computeSessionTotals(session._id, session.businessDate);
    }

    return res.json({
      success: true,
      serverTimePKT: now.format('YYYY-MM-DD hh:mm:ss A'),
      currentBusinessDate: currentDate,
      isWithinOperatingHours: withinOperatingHours,
      isOpen: isOpen,
      closeReason: reason || null,
      session: session ? {
        ...session.toObject(),
        liveStats: sessionStats,
      } : null,
      currentTotalStock: currentStock,
    });
  } catch (error) {
    console.error('[getCurrentSession Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve business session' });
  }
};

// @desc    Manually Open Business Session (if authorized)
// @route   POST /api/sessions/open
export const openSession = async (req, res) => {
  try {
    const now = getNowPKT();
    const currentDate = getCurrentBusinessDate();

    let session = await BusinessSession.findOne({ businessDate: currentDate });

    if (session && session.status === 'OPEN') {
      return res.status(400).json({ success: false, message: 'Today session is already OPEN' });
    }

    const currentStock = await calculateTotalCurrentStock();
    const prevSession = await BusinessSession.findOne({ businessDate: { $lt: currentDate } }).sort({ businessDate: -1 });
    const openingStock = prevSession ? prevSession.closingStock || currentStock : currentStock;

    if (!session) {
      session = await BusinessSession.create({
        businessDate: currentDate,
        openingTime: now.toDate(),
        scheduledOpeningTime: '07:00 AM',
        scheduledClosingTime: '07:00 PM',
        openingStock,
        closingStock: currentStock,
        status: 'OPEN',
      });
    } else {
      // Re-open if closed and admin specifically requests
      session.status = 'OPEN';
      session.closingTime = null;
      session.closeReason = undefined;
      await session.save();
    }

    await AuditLog.create({
      action: 'SESSION_OPENED',
      entityType: 'BusinessSession',
      entityId: session._id,
      details: { businessDate: currentDate, openingStock },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'Admin',
    });

    return res.json({
      success: true,
      message: `Business session for ${currentDate} is now OPEN.`,
      data: session,
    });
  } catch (error) {
    console.error('[openSession Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to open business session' });
  }
};

// @desc    Manual Close Business Session
// @route   POST /api/sessions/close
export const closeSession = async (req, res) => {
  try {
    const { notes } = req.body;
    const now = getNowPKT();
    const currentDate = getCurrentBusinessDate();

    const session = await BusinessSession.findOne({ businessDate: currentDate });

    if (!session) {
      return res.status(404).json({ success: false, message: 'No active session found for today to close' });
    }

    if (session.status === 'CLOSED') {
      return res.status(400).json({ success: false, message: 'Today session has already been CLOSED' });
    }

    // Compute final closing stats
    const totals = await computeSessionTotals(session._id, currentDate);

    session.closingTime = now.toDate();
    session.status = 'CLOSED';
    session.closeReason = 'MANUAL_CLOSING';
    session.manualCloseNotes = notes || 'Manually closed by authorized user';
    session.closedBy = req.user ? req.user._id : null;
    Object.assign(session, totals);

    await session.save();

    await AuditLog.create({
      action: 'SESSION_CLOSED_MANUALLY',
      entityType: 'BusinessSession',
      entityId: session._id,
      details: {
        businessDate: currentDate,
        totals,
        closedBy: req.user ? req.user.name : 'Admin',
        closingTimePKT: formatPKT(now.toDate()),
      },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'Admin',
    });

    return res.json({
      success: true,
      message: `Business session for ${currentDate} has been CLOSED successfully.`,
      data: session,
    });
  } catch (error) {
    console.error('[closeSession Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to close business session' });
  }
};

// @desc    Delete a business session by ID (admin only)
// @route   DELETE /api/sessions/:id
export const deleteSession = async (req, res) => {
  try {
    const session = await BusinessSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await BusinessSession.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'SESSION_DELETED',
      entityType: 'BusinessSession',
      entityId: req.params.id,
      details: { businessDate: session.businessDate, deletedBy: req.user?.name || 'Admin' },
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'Admin',
    });

    return res.json({ success: true, message: `Session for ${session.businessDate} deleted successfully.` });
  } catch (error) {
    console.error('[deleteSession Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
};

// @desc    Get session closing history
// @route   GET /api/sessions/history
export const getSessionHistory = async (req, res) => {
  try {
    const { startDate, endDate, limit = 60 } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.businessDate = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const sessions = await BusinessSession.find(query)
      .sort({ businessDate: -1 })
      .limit(Number(limit))
      .populate('closedBy', 'name email');

    return res.json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error('[getSessionHistory Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch session history' });
  }
};

