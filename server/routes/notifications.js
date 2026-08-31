const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const pool = require('../config/postgres');

// @route   GET /api/notifications
// @desc    Get recent notifications for user / admin
// @access  Admin, Teacher
router.get('/', auth, async (req, res) => {
  try {
    const role = req.user.role || 'teacher';
    const userId = req.user.id;

    let query;
    let params;

    if (role === 'admin') {
      query = `
        SELECT id, recipient_role, recipient_id, sender_id, sender_name,
               question_id, related_paper_id, type, title, message,
               difficulty, metadata, is_read, created_at, read_at
        FROM public.notifications
        WHERE recipient_role = 'admin' OR recipient_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      params = [userId];
    } else {
      query = `
        SELECT id, recipient_role, recipient_id, sender_id, sender_name,
               question_id, related_paper_id, type, title, message,
               difficulty, metadata, is_read, created_at, read_at
        FROM public.notifications
        WHERE recipient_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ msg: 'Server error fetching notifications' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Admin, Teacher
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notifId = req.params.id;
    const result = await pool.query(`
      UPDATE public.notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [notifId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking notification read:', err.message);
    res.status(500).json({ msg: 'Server error updating notification' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read for role/user
// @access  Admin, Teacher
router.put('/read-all', auth, async (req, res) => {
  try {
    const role = req.user.role || 'teacher';
    const userId = req.user.id;

    if (role === 'admin') {
      await pool.query(`
        UPDATE public.notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE (recipient_role = 'admin' OR recipient_id = $1) AND is_read = FALSE
      `, [userId]);
    } else {
      await pool.query(`
        UPDATE public.notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE recipient_id = $1 AND is_read = FALSE
      `, [userId]);
    }

    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all read:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Helper function to create notification programmatically
async function createNotification({
  recipient_role = 'admin',
  recipient_id = null,
  sender_id = null,
  sender_name,
  related_paper_id = null,
  type = 'paper_submission',
  title,
  message,
  metadata = {}
}) {
  try {
    // Prevent duplicate notification if exact same submission was created in past 60 seconds
    const existing = await pool.query(`
      SELECT id FROM public.notifications
      WHERE related_paper_id = $1 AND sender_name = $2 AND created_at > NOW() - INTERVAL '60 seconds'
      LIMIT 1
    `, [related_paper_id, sender_name]);

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const result = await pool.query(`
      INSERT INTO public.notifications (
        recipient_role, recipient_id, sender_id, sender_name,
        related_paper_id, type, title, message, metadata, is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NOW())
      RETURNING *
    `, [
      recipient_role,
      recipient_id,
      sender_id,
      sender_name,
      related_paper_id,
      type,
      title,
      message,
      JSON.stringify(metadata)
    ]);
    return result.rows[0];
  } catch (err) {
    console.error('Error creating notification in DB:', err.message);
    return null;
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
