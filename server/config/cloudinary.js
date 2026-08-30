const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

let storage;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      if (file && file.mimetype === 'application/pdf') {
        return {
          folder: 'qpg_uploads',
          format: 'pdf',
          resource_type: 'raw'
        };
      }
      return {
        folder: 'qpg_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'svg', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
      };
    }
  });
  console.log('☁️ Cloudinary storage configured successfully.');
} else {
  console.warn('⚠️ Cloudinary environment variables missing. Falling back to local disk storage.');

  // Custom local disk storage that returns relative web URL path
  const uploadsDir = path.resolve(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  function DiskStorageWithUrl() {}

  DiskStorageWithUrl.prototype._handleFile = function _handleFile(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    const finalPath = path.join(uploadsDir, filename);
    const outStream = fs.createWriteStream(finalPath);

    file.stream.pipe(outStream);
    outStream.on('error', cb);
    outStream.on('finish', () => {
      cb(null, {
        destination: uploadsDir,
        filename: filename,
        path: `/uploads/${filename}`, // Return the relative web URL as req.file.path
        size: outStream.bytesWritten
      });
    });
  };

  DiskStorageWithUrl.prototype._removeFile = function _removeFile(req, file, cb) {
    const filePath = path.join(uploadsDir, file.filename);
    fs.unlink(filePath, cb);
  };

  storage = new DiskStorageWithUrl();
}

module.exports = { cloudinary, storage };

