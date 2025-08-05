const DatabaseAdapter = require('./DatabaseAdapter');
class MySQLAdapter extends DatabaseAdapter {
    constructor(pool) {
        super();
        this.pool = pool;
    }
     async createUser(userData) { // Poprawka: przyjmuje obiekt userData
        const { name, email, hashedPassword, role } = userData;
        const [result] = await this.pool.execute(`
            INSERT INTO users (name, email, password, role, wallet_balance, active)
            VALUES (?, ?, ?, ?, 0.00, true)
        `, [name, email.toLowerCase(), hashedPassword, role]);
        return result.insertId;
    }

    async getUserByEmail(email) {
        const [users] = await this.pool.execute(`
            SELECT id, name, email, password, role, wallet_balance, photo, active, password_changed_at
            FROM users WHERE email = ?
        `, [email.toLowerCase()]);
        return users[0] || null;
    }

    async getUserById(userId) {
        const [users] = await this.pool.execute(`
            SELECT id, name, email, role, wallet_balance, photo, active, password_changed_at
            FROM users WHERE id = ?
        `, [userId]);
        return users[0] || null;
    }
     async updateUser(userId, userData) {
        const fields = Object.keys(userData);
        const values = Object.values(userData);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        await this.pool.execute(`
            UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [...values, userId]);
    }

     async getPassword(userId) {
        const [users] = await this.pool.execute(`
            SELECT password FROM users WHERE id = ?
        `, [userId]);
        return users[0]?.password || null;
    }

    async updatePassword(userId, hashedPassword) {
        await this.pool.execute(`
            UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [hashedPassword, userId]);
    }

    async updatePasswordResetToken(userId, hashedToken, expiresAt) {
        await this.pool.execute(`
            UPDATE users 
            SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [hashedToken, expiresAt, userId]);
    }

    async getUserByResetToken(hashedToken) {
        const [users] = await this.pool.execute(`
            SELECT id, email, password_reset_expires 
            FROM users 
            WHERE password_reset_token = ? AND password_reset_expires > NOW()
        `, [hashedToken]);
        return users[0] || null;
    }

    async clearPasswordResetToken(userId) {
        await this.pool.execute(`
            UPDATE users 
            SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [userId]);
    }
}

module.exports = MySQLAdapter;