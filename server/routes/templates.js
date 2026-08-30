const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Template = require('../models/Template');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

const { storage } = require('../config/cloudinary');

const upload = multer({
    storage,
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

        const template = new Template({
            filename,
            originalName,
            title: req.body.title || (req.file ? req.file.originalname : 'Custom Template'),
            description: req.body.description || '',
            uploadedBy: req.user.id,
            fileUrl,
            templateType: req.body.templateType || 'FULL_PAPER',
            institutionName: req.body.institutionName || '',
            address: req.body.address || '',
            headerText: req.body.headerText || '',
            instructions: req.body.instructions || '',
            footerText: req.body.footerText || '',
            watermarkText: req.body.watermarkText || ''
        });

        await template.save();
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
        const templates = await Template.find().sort({ createdAt: -1 });
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
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ msg: 'Template not found' });

        // Delete file from Cloudinary or local disk
        if (template.fileUrl && template.fileUrl.includes('cloudinary.com')) {
            const { cloudinary } = require('../config/cloudinary');
            if (template.filename) {
                // If it is raw file (like PDF), Cloudinary sometimes requires resource_type: 'raw'
                const isPdf = template.fileUrl.toLowerCase().endsWith('.pdf') || template.filename.toLowerCase().endsWith('.pdf');
                await cloudinary.uploader.destroy(template.filename, {
                    resource_type: isPdf ? 'raw' : 'image'
                });
            }
        } else if (template.filename) {
            const uploadsDir = path.resolve(__dirname, '../uploads');
            const filePath = path.join(uploadsDir, template.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Template.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Template deleted' });
    } catch (err) {
        console.error('Template deletion error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;

