const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = require('../services/postgresStorage');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

const { storage: cloudStorage } = require('../config/cloudinary');

const upload = multer({
    storage: cloudStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only image and PDF files are allowed'), false);
    }
});

// @route   POST /api/templates
// @desc    Upload or create a custom template
// @access  Admin
router.post('/', [auth, checkRole(['admin']), upload.single('template')], async (req, res) => {
    try {
        let fileUrl = '';
        let filename = '';
        let originalName = '';

        if (req.file) {
            fileUrl = req.file.path;
            filename = req.file.filename;
            originalName = req.file.originalname;
        }

        const templateData = {
            filename,
            originalName,
            name: req.body.title || (req.file ? req.file.originalname : 'Custom Template'),
            title: req.body.title || (req.file ? req.file.originalname : 'Custom Template'),
            description: req.body.description || '',
            uploadedBy: req.user.id,
            fileUrl,
            templateType: req.body.templateType || 'FULL_PAPER',
            subject: req.body.subject || null,
            examType: req.body.examType || 'CET',
            classLevel: req.body.classLevel || '12',
            durationMinutes: req.body.durationMinutes || 60,
            totalMarks: req.body.totalMarks || 60,
            headerConfig: {
                institutionName: req.body.institutionName || '',
                address: req.body.address || '',
                headerText: req.body.headerText || '',
                instructions: req.body.instructions || '',
                footerText: req.body.footerText || '',
                watermarkText: req.body.watermarkText || ''
            }
        };

        const template = await storage.saveTemplate(templateData);
        res.json(template);
    } catch (err) {
        console.error('Template upload/creation error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   GET /api/templates
// @desc    Get all templates
// @access  Admin & Teacher
router.get('/', auth, async (req, res) => {
    try {
        const templates = await storage.getTemplates();
        res.json(templates);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   DELETE /api/templates/:id
// @desc    Delete a template
// @access  Admin
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
    try {
        res.json({ msg: 'Template deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
