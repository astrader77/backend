import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Get store settings
// @route   GET /api/settings
export const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[getSettings Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

// @desc    Update store settings
// @route   PUT /api/settings
export const updateSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();

    await AuditLog.create({
      action: 'SETTINGS_UPDATED',
      entityType: 'Setting',
      entityId: settings._id,
      details: req.body,
      performedBy: req.user ? req.user._id : null,
      performedByName: req.user ? req.user.name : 'Admin',
    });

    return res.json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (error) {
    console.error('[updateSettings Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

