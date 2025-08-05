const bcryptjs = require('bcryptjs');

const crypto = require('crypto');

class AuthService {
    constructor(dbAdapter) {
        this.db = dbAdapter;
    }

    async register(userData) {
        const { name, email, password, confirmPassword, role = 'user' } = userData;
        console.log(name, email, password, confirmPassword, role);

        // Walidacja
        if (!name || !email || !password || !confirmPassword) {
            throw new Error('Wszystkie pola są wymagane');
        }

        if (password !== confirmPassword) {
            throw new Error('Hasła nie są identyczne');
        }

        if (password.length < 8) {
            throw new Error('Hasło musi mieć co najmniej 8 znaków');
        }

        // Sprawdź czy użytkownik istnieje
        const existingUser = await this.db.getUserByEmail(email);
        if (existingUser) {
            throw new Error('Użytkownik z tym adresem email już istnieje');
        }

        // Hash hasła
        const hashedPassword = await bcryptjs.hash(password, 12);
        const userId = await this.db.createUser({
            name,
            email,
            hashedPassword,
            role
        });

        return await this.db.getUserById(userId);
    }

    async login(credentials) {
        const { email, password } = credentials;
        
        if (!email || !password) {
            throw new Error('Email i hasło są wymagane');
        }

        const user = await this.db.getUserByEmail(email);
        if (!user) {
            throw new Error('Nieprawidłowy email lub hasło');
        }

        if (!user.active) {
            throw new Error('Konto zostało dezaktywowane');
        }

        const isPasswordCorrect = await bcryptjs.compare(password, user.password);
        if (!isPasswordCorrect) {
            throw new Error('Nieprawidłowy email lub hasło');
        }

        // Usuń hasło z odpowiedzi
        delete user.password;
        return user;
    }

    async getUserById(userId) {
        const user = await this.db.getUserById(userId);
        if (!user) {
            throw new Error('Użytkownik nie istnieje');
        }
        return user;
    }
    async changePassword(userId, oldPassword, newPassword) {
        // Pobierz hasło użytkownika
        const userPassword = await this.db.getPassword(userId);
        if (!userPassword) {
            throw new Error('Użytkownik nie istnieje');
        }

        // Sprawdź stare hasło
        const isCurrentPasswordCorrect = await bcryptjs.compare(oldPassword, userPassword);
        
        if (!isCurrentPasswordCorrect) {
            throw new Error('Aktualne hasło jest nieprawidłowe');
        }

        // Zahashuj nowe hasło
        const hashedNewPassword = await bcryptjs.hash(newPassword, 12);
        await this.db.updatePassword(userId, hashedNewPassword);

        return { message: 'Hasło zostało zmienione pomyślnie' };
    }

    async forgotPassword(email) {
        // Znajdź użytkownika
        const user = await this.db.getUserByEmail(email);
        if (!user) {
            throw new Error('Nie ma użytkownika z tym adresem email');
        }

        if (!user.active) {
            throw new Error('Konto zostało dezaktywowane');
        }

        // Generuj token resetowania
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minut

        // Zapisz token w bazie
        await this.db.updatePasswordResetToken(user.id, hashedResetToken, resetTokenExpires);

        // W rzeczywistej aplikacji tutaj wysłałbyś email
        console.log('Reset token dla', email, ':', resetToken);

        return { 
            message: 'Token resetowania hasła został wysłany na email',
            resetToken: resetToken // W produkcji usuń to!
        };
    }

    async resetPassword(token, newPassword) {
        // Hashuj token i znajdź użytkownika
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await this.db.getUserByResetToken(hashedToken);

        if (!user) {
            throw new Error('Token jest nieprawidłowy lub wygasł');
        }

        // Hashuj nowe hasło
        const hashedNewPassword = await bcryptjs.hash(newPassword, 12);

        // Aktualizuj hasło
        await this.db.updatePassword(user.id, hashedNewPassword);
        
        // Usuń token resetowania
        await this.db.clearPasswordResetToken(user.id);

        return { 
            message: 'Hasło zostało pomyślnie zresetowane',
            userId: user.id 
        };
    }
}
    
module.exports = AuthService;