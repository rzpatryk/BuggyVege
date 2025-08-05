const DatabaseAdapter = require('./DatabaseAdapter');
const User = require('../../Models/userModel'); // Import the User model

class MongoAdapter extends DatabaseAdapter {
    async createUser(userData) {
        const { name, email, hashedPassword, role } = userData;
        
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            wallet: {
                balance: 0.00,
                currency: 'PLN'
            },
            active: true
        });
        
        return user._id.toString();
    }

    async getUserByEmail(email) {
        const user = await User.findOne({ email: email.toLowerCase() })
            .select('+password +active +passwordChangedAt');
        
        if (!user) return null;
        
        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role,
            wallet_balance: user.wallet.balance,
            photo: user.photo,
            active: user.active,
            password_changed_at: user.passwordChangedAt
        };
    }

    async getUserById(userId) {
        const user = await User.findById(userId)
            .select('+active +passwordChangedAt');
        
        if (!user) return null;
        
        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            wallet_balance: user.wallet.balance,
            photo: user.photo,
            active: user.active,
            password_changed_at: user.passwordChangedAt
        };
    }

    async updateUser(userId, userData) {
        await User.findByIdAndUpdate(userId, {
            ...userData,
            updatedAt: new Date()
        });
    }

    async getPassword(userId) {
        const user = await User.findById(userId).select('+password');
        return user?.password || null;
    }

    async updatePassword(userId, hashedPassword) {
        await User.findByIdAndUpdate(userId, {
            password: hashedPassword,
            passwordChangedAt: new Date()
        });
    }

    async updatePasswordResetToken(userId, hashedToken, expiresAt) {
        await User.findByIdAndUpdate(userId, {
            passwordResetToken: hashedToken,
            passwordResetTokenExpires: expiresAt,
            updatedAt: new Date()
        });
    }

    async getUserByResetToken(hashedToken) {
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetTokenExpires: { $gt: Date.now() }
        });
        
        if (!user) return null;
        
        return {
            id: user._id.toString(),
            email: user.email,
            password_reset_expires: user.passwordResetTokenExpires
        };
    }

    async clearPasswordResetToken(userId) {
    await User.findByIdAndUpdate(userId, {
        $unset: {
            passwordResetToken: 1,
            passwordResetTokenExpires: 1
        },
        $set: {
            updatedAt: new Date()
        }
    });
}
}

module.exports = MongoAdapter;