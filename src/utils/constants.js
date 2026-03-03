module.exports = {
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    CONSULTANT: 'CONSULTANT',
    CLIENT: 'CLIENT',
  },
  
  BookingStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
    NO_SHOW: 'NO_SHOW',
  },
  
  ApplicationStatus: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    DOCUMENTS_MISSING: 'DOCUMENTS_MISSING',
    PROCESSING: 'PROCESSING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CLOSED: 'CLOSED',
  },
  
  PaymentStatus: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  },
  
  PaymentType: {
    CONSULTATION: 'CONSULTATION',
    PROCESSING: 'PROCESSING',
  },
  
  NoteType: {
    INTERNAL: 'INTERNAL',
    CLIENT_VISIBLE: 'CLIENT_VISIBLE',
  },
  
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ],
};