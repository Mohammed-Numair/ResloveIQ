import jwt from 'jsonwebtoken';

/**
 * Generate a signed JWT token for authenticated users
 * @param {string} id - The MongoDB User ID
 * @returns {string} - Signed JWT token
 */
export const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'resolveiq_fallback_development_secret';
  return jwt.sign({ id }, secret, {
    expiresIn: '7d',
  });
};

export default generateToken;

