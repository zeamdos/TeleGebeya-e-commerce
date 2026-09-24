/**
 * Receipt Validation Utility
 * Production-grade validation for payment receipt uploads
 * 
 * Security & Performance Considerations:
 * - File type validation to prevent malicious uploads
 * - Size limits to prevent storage abuse
 * - Filename sanitization to prevent path traversal
 * - Content validation for base64 uploads
 * - Scalable validation logic
 */

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_FILE_SIZE_BYTES = 1024; // 1KB (reject empty files)

const BASE64_MAX_LENGTH = 10 * 1024 * 1024; // 10MB for base64 strings

/**
 * Sanitize filename to prevent path traversal and other attacks
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename) return 'receipt';
  
  // Remove path components
  const sanitized = filename.replace(/^[\/\\]+/, '').replace(/[\/\\]/g, '_');
  
  // Remove special characters that could be problematic
  const cleaned = sanitized.replace(/[^\w\-_.]/g, '_');
  
  // Limit length
  const maxLength = 100;
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
}

/**
 * Validate file extension
 * @param {string} filename - Filename to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateExtension(filename) {
  if (!filename) {
    return { valid: false, error: 'No filename provided' };
  }
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate MIME type
 * @param {string} mimeType - MIME type to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateMimeType(mimeType) {
  if (!mimeType) {
    return { valid: false, error: 'No MIME type provided' };
  }
  
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateFileSize(size) {
  if (typeof size !== 'number' || size < 0) {
    return { valid: false, error: 'Invalid file size' };
  }
  
  if (size < MIN_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too small. Minimum size: ${MIN_FILE_SIZE_BYTES} bytes`
    };
  }
  
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
    };
  }
  
  return { valid: true };
}

/**
 * Validate base64 string
 * @param {string} base64String - Base64 encoded string
 * @returns {Object} - { valid: boolean, error: string, size: number }
 */
function validateBase64(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return { valid: false, error: 'Invalid base64 string' };
  }
  
  // Check length
  if (base64String.length > BASE64_MAX_LENGTH) {
    return {
      valid: false,
      error: `Base64 string too large. Maximum: ${BASE64_MAX_LENGTH / (1024 * 1024)}MB`
    };
  }
  
  // Check if it's a valid base64 string
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  const dataPart = base64String.split(',')[1] || base64String; // Handle data URI prefix
  
  if (!base64Regex.test(dataPart)) {
    return { valid: false, error: 'Invalid base64 format' };
  }
  
  // Calculate approximate size
  const size = Math.ceil((dataPart.length * 3) / 4);
  
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Decoded file too large. Maximum: ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
    };
  }
  
  return { valid: true, size };
}

/**
 * Validate base64 data URI format
 * @param {string} dataUri - Data URI string
 * @returns {Object} - { valid: boolean, error: string, mimeType: string, data: string }
 */
function validateDataUri(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') {
    return { valid: false, error: 'Invalid data URI' };
  }
  
  const dataUriRegex = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/;
  const match = dataUri.match(dataUriRegex);
  
  if (!match) {
    return { valid: false, error: 'Invalid data URI format' };
  }
  
  const mimeType = match[1];
  const data = match[2];
  
  // Validate MIME type
  const mimeValidation = validateMimeType(mimeType);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }
  
  // Validate base64 data
  const base64Validation = validateBase64(data);
  if (!base64Validation.valid) {
    return base64Validation;
  }
  
  return {
    valid: true,
    mimeType,
    data,
    size: base64Validation.size
  };
}

/**
 * Comprehensive receipt validation for file uploads
 * @param {Object} fileData - File data object
 * @returns {Object} - { valid: boolean, error: string, sanitized: Object }
 */
function validateReceiptUpload(fileData) {
  const errors = [];
  const sanitized = {};
  
  // Validate filename
  if (fileData.originalname) {
    const extValidation = validateExtension(fileData.originalname);
    if (!extValidation.valid) {
      errors.push(extValidation.error);
    } else {
      sanitized.filename = sanitizeFilename(fileData.originalname);
    }
  }
  
  // Validate MIME type
  if (fileData.mimetype) {
    const mimeValidation = validateMimeType(fileData.mimetype);
    if (!mimeValidation.valid) {
      errors.push(mimeValidation.error);
    } else {
      sanitized.mimetype = fileData.mimetype;
    }
  }
  
  // Validate file size
  if (fileData.size) {
    const sizeValidation = validateFileSize(fileData.size);
    if (!sizeValidation.valid) {
      errors.push(sizeValidation.error);
    } else {
      sanitized.size = fileData.size;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Comprehensive receipt validation for base64 uploads
 * @param {string} base64Data - Base64 encoded receipt data
 * @param {string} filename - Optional original filename
 * @returns {Object} - { valid: boolean, error: string, sanitized: Object }
 */
function validateReceiptBase64(base64Data, filename = 'receipt') {
  // Validate data URI format
  const dataUriValidation = validateDataUri(base64Data);
  if (!dataUriValidation.valid) {
    return dataUriValidation;
  }
  
  // Validate filename if provided
  let sanitizedFilename = sanitizeFilename(filename);
  const extValidation = validateExtension(sanitizedFilename);
  if (!extValidation.valid) {
    // Add default extension based on MIME type
    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf'
    };
    sanitizedFilename += extMap[dataUriValidation.mimeType] || '.jpg';
  }
  
  return {
    valid: true,
    sanitized: {
      filename: sanitizedFilename,
      mimetype: dataUriValidation.mimeType,
      size: dataUriValidation.size,
      data: dataUriValidation.data
    }
  };
}

/**
 * Check if transaction ID format is valid
 * @param {string} transactionId - Transaction ID to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateTransactionId(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') {
    return { valid: false, error: 'Transaction ID is required' };
  }
  
  // Remove whitespace
  const trimmed = transactionId.trim();
  
  if (trimmed.length < 8) {
    return { valid: false, error: 'Transaction ID too short (minimum 8 characters)' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Transaction ID too long (maximum 100 characters)' };
  }
  
  // Allow alphanumeric and common separators
  const validPattern = /^[A-Za-z0-9\-_ ]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Transaction ID contains invalid characters' };
  }
  
  return { valid: true, sanitized: trimmed };
}

/**
 * Main validation function for receipt submission
 * @param {Object} receiptData - Receipt submission data
 * @returns {Object} - { valid: boolean, errors: string[], sanitized: Object }
 */
function validateReceiptSubmission(receiptData) {
  const errors = [];
  const sanitized = {};
  
  // Validate receipt image/base64
  if (receiptData.receiptImage) {
    const receiptValidation = validateReceiptBase64(
      receiptData.receiptImage,
      receiptData.filename
    );
    
    if (!receiptValidation.valid) {
      errors.push(receiptValidation.error || 'Invalid receipt image');
    } else {
      sanitized.receiptImage = receiptValidation.sanitized.data;
      sanitized.receiptFilename = receiptValidation.sanitized.filename;
      sanitized.receiptMimeType = receiptValidation.sanitized.mimetype;
      sanitized.receiptSize = receiptValidation.sanitized.size;
    }
  } else {
    errors.push('Receipt image is required');
  }
  
  // Validate transaction ID if provided
  if (receiptData.transactionId) {
    const txnValidation = validateTransactionId(receiptData.transactionId);
    if (!txnValidation.valid) {
      errors.push(txnValidation.error);
    } else {
      sanitized.transactionId = txnValidation.sanitized;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MIN_FILE_SIZE_BYTES,
  sanitizeFilename,
  validateExtension,
  validateMimeType,
  validateFileSize,
  validateBase64,
  validateDataUri,
  validateReceiptUpload,
  validateReceiptBase64,
  validateTransactionId,
  validateReceiptSubmission
};