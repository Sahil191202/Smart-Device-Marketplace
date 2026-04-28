/**
 * Extract data from standardized API response envelope.
 * All our APIs return: { success, message, data, meta }
 */
export const extractData = (response) => {
  return response?.data?.data || response?.data || null;
};

export const extractMeta = (response) => {
  return response?.data?.meta || null;
};

export const extractMessage = (response) => {
  return response?.data?.message || 'Success';
};

export const extractError = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    'An error occurred'
  );
};

/**
 * Build query params string from object, removing undefined/null/empty values
 */
export const buildParams = (params = {}) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};