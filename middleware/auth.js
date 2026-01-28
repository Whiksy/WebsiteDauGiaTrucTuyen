const jwt = require('jsonwebtoken');
const { sql } = require('../config/database');
const appSettings = require('../config/appsettings');

const JWT_SECRET = process.env.JWT_SECRET || appSettings.Jwt.Secret;

// --- Logger Throttling (Giảm spam log) ---
let lastAuthLog = 0;
const logAuthError = (msg) => {
    const now = Date.now();
    if (now - lastAuthLog > 5000) { // Chỉ log mỗi 5 giây
        console.error(msg + ' (Throttled)');
        lastAuthLog = now;
    }
};

// Helper: Lấy roles từ DB (được định nghĩa ở cuối file, đưa lên đây để dùng)
const getUserRolesFromDb = async (userId) => {
  try {
    const pool = await sql.connect();
    const res = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT r.Name FROM Roles r JOIN UserRoles ur ON ur.RoleId = r.Id WHERE ur.UserId = @userId');
    return res.recordset.map(r => r.Name);
  } catch (e) {
    logAuthError(`getUserRolesFromDb error: ${e.message}`);
    return [];
  }
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // Kiểm tra kỹ hơn các trường hợp token rác (undefined, null)
  if (!token || token === 'undefined' || token === 'null') {
    logAuthError('❌ [Auth] No token provided or invalid format');
    return res.status(403).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      logAuthError(`❌ [Auth] Token verification failed: ${err.name} - ${err.message}`);
      return res.status(401).json({ message: 'Unauthorized', error: err.message });
    }
    
    req.user = decoded;
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    
    // CƠ CHẾ TỰ SỬA LỖI: Nếu Token thiếu roles, tự động lấy lại từ DB
    if (decoded.roles && decoded.roles.length > 0) {
        req.userRoles = decoded.roles;
    } else {
        console.warn(`⚠️ [Auth] Token missing roles. Fetching from DB for UserID: ${decoded.id}...`);
        req.userRoles = await getUserRolesFromDb(decoded.id);
    }

    console.log(`✅ [Auth] User: ${req.userEmail} | Roles: ${JSON.stringify(req.userRoles)}`);
    next();
  });
};

const authorizeRole = (allowedRoles = []) => {
  return (req, res, next) => {
    const roles = req.userRoles || [];
    const ok = roles.some(r => allowedRoles.includes(r));
    
    if (!ok) {
      console.warn(`⚠️ [Auth] Access denied. User Roles: ${JSON.stringify(roles)}, Required: ${JSON.stringify(allowedRoles)}`);
      return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRole, getUserRolesFromDb };
