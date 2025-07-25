const JWT_CONFIG = {
    secret: process.env.JWT_SECRET || 'your-secret-key-12345',
    expiresIn: '24h'
};

module.exports = JWT_CONFIG;