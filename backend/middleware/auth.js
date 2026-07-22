import { auth } from '../config/firebaseAdmin.js';

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Dev mode bypass for mock tokens
  if (token.startsWith('mock_token_') || token.startsWith('mock_user_')) {
    const uid = token.replace('mock_token_', '');
    // Construct mock decoded user info
    req.user = {
      uid: uid,
      phone: uid.includes('_') ? uid.split('_').pop() : '1234567890',
      isMock: true
    };
    return next();
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      phone: decodedToken.phone_number || '',
      isMock: false
    };
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
