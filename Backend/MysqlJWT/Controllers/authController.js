const { pool } = require('../../database');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const crypto = require('crypto');
const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');
const { log } = require('console');

const signToken = id => {
    return jwt.sign({id}, process.env.SECRET_STR, {
        expiresIn: process.env.LOGIN_EXPIRES
    });
}

exports.signup = asyncErrorHandler(async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { name, email, password, confirmPassword, role = 'user' } = req.body;

        // Walidacja danych
        if (!name || !email || !password || !confirmPassword) {
            const error = new CustomError('Wszystkie pola są wymagane', 400);
            return next(error);
        }

        if (password !== confirmPassword) {
            const error = new CustomError('Hasła nie są identyczne', 400);
            return next(error);
        }

        if (password.length < 8) {
            const error = new CustomError('Hasło musi mieć co najmniej 8 znaków', 400);
            return next(error);
        }

        // Sprawdź czy email już istnieje
        const [existingUser] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUser.length > 0) {
            const error = new CustomError('Użytkownik z tym adresem email już istnieje', 400);
            return next(error);
        }

        // Hashuj hasło
        const hashedPassword = await bcryptjs.hash(password, 12);

        // Utwórz użytkownika
        const [result] = await connection.execute(`
            INSERT INTO users (name, email, password, role, wallet_balance, active)
            VALUES (?, ?, ?, ?, 0.00, true)
        `, [name, email.toLowerCase(), hashedPassword, role]);

        const userId = result.insertId;

        // Pobierz utworzonego użytkownika (bez hasła)
        const [newUser] = await connection.execute(`
            SELECT id, name, email, role, wallet_balance, photo, created_at
            FROM users WHERE id = ?
        `, [userId]);

        await connection.commit();

        // Generuj token
        const token = signToken(userId);

        res.status(201).json({
            status: 'success',
            token,
            data: {
                user: {
                    id: newUser[0].id,
                    name: newUser[0].name,
                    email: newUser[0].email,
                    role: newUser[0].role,
                    wallet: {
                        balance: newUser[0].wallet_balance,
                        currency: 'PLN'
                    },
                    photo: newUser[0].photo,
                    createdAt: newUser[0].created_at
                }
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd rejestracji:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            const customError = new CustomError('Użytkownik z tym adresem email już istnieje', 400);
            return next(customError);
        }
        
        const customError = new CustomError('Błąd podczas rejestracji użytkownika', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

exports.login = asyncErrorHandler(async (req, res, next) => {
    const { email, password } = req.body;
    
    // Walidacja danych wejściowych
    if (!email || !password) {
        const error = new CustomError('Podaj email i hasło', 400);
        return next(error);
    }

    try {
        // Znajdź użytkownika po emailu
        const [users] = await pool.execute(`
            SELECT id, name, email, password, role, wallet_balance, photo, active, password_changed_at
            FROM users WHERE email = ?
        `, [email.toLowerCase()]);

        if (users.length === 0) {
            const error = new CustomError('Nieprawidłowy email lub hasło', 401);
            return next(error);
        }

        const user = users[0];

        // Sprawdź czy konto jest aktywne
        if (!user.active) {
            const error = new CustomError('Konto zostało dezaktywowane', 401);
            return next(error);
        }

        // Sprawdź hasło
        const isPasswordCorrect = await bcryptjs.compare(password, user.password);
        
        if (!isPasswordCorrect) {
            const error = new CustomError('Nieprawidłowy email lub hasło', 401);
            return next(error);
        }

        // Generuj token
        const token = signToken(user.id);

        // Usuń hasło z odpowiedzi
        delete user.password;

        res.status(200).json({
            status: 'success',
            token,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    wallet: {
                        balance: user.wallet_balance,
                        currency: 'PLN'
                    },
                    photo: user.photo
                }
            }
        });

    } catch (error) {
        console.error('Błąd logowania:', error);
        const customError = new CustomError('Błąd podczas logowania', 500);
        return next(customError);
    }
});

// Middleware do weryfikacji JWT token
exports.protect = asyncErrorHandler(async (req, res, next) => {
    // 1) Sprawdź czy token istnieje
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        const error = new CustomError('Nie jesteś zalogowany. Zaloguj się, aby uzyskać dostęp.', 401);
        return next(error);
    }

    try {
        // 2) Weryfikuj token
        const decoded = jwt.verify(token, process.env.SECRET_STR);

        // 3) Sprawdź czy użytkownik nadal istnieje
        const [users] = await pool.execute(`
            SELECT id, name, email, role, wallet_balance, photo, active, password_changed_at
            FROM users WHERE id = ?
        `, [decoded.id]);

        if (users.length === 0) {
            const error = new CustomError('Użytkownik przypisany do tego tokenu już nie istnieje.', 401);
            return next(error);
        }

        const currentUser = users[0];

        // Sprawdź czy konto jest aktywne
        if (!currentUser.active) {
            const error = new CustomError('Konto zostało dezaktywowane', 401);
            return next(error);
        }

        // 4) Sprawdź czy hasło nie zostało zmienione po wydaniu tokenu
        if (currentUser.password_changed_at) {
            const passwordChangedTimestamp = parseInt(
                new Date(currentUser.password_changed_at).getTime() / 1000, 
                10
            );
            
            if (decoded.iat < passwordChangedTimestamp) {
                const error = new CustomError('Hasło zostało niedawno zmienione. Zaloguj się ponownie.', 401);
                return next(error);
            }
        }

        // Przekaż użytkownika do następnego middleware
        req.user = {
            id: currentUser.id
            // name: currentUser.name,
            // email: currentUser.email,
            // role: currentUser.role,
            // wallet: {
            //     balance: currentUser.wallet_balance,
            //     currency: 'PLN'
            // },
            // photo: currentUser.photo
        };
        
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            const customError = new CustomError('Nieprawidłowy token. Zaloguj się ponownie.', 401);
            return next(customError);
        } else if (error.name === 'TokenExpiredError') {
            const customError = new CustomError('Token wygasł. Zaloguj się ponownie.', 401);
            return next(customError);
        }
        
        console.error('Błąd weryfikacji tokenu:', error);
        const customError = new CustomError('Błąd podczas weryfikacji tokenu', 500);
        return next(customError);
    }
});

// Middleware do autoryzacji ról
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            const error = new CustomError('Nie masz uprawnień do wykonania tej akcji', 403);
            return next(error);
        }
        next();
    };
};
// Endpoint do sprawdzenia profilu użytkownika (chroniony)
exports.getProfileTest = asyncErrorHandler(async (req, res, next) => {
     const { userId } = req.params;
    try {
        // Pobierz najnowsze dane użytkownika z bazy
        const [users] = await pool.execute(`
            SELECT id, name, email, role, wallet_balance, photo, created_at, updated_at
            FROM users WHERE id = ?
        `, [userId]);

        if (users.length === 0) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

        const user = users[0];

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    wallet: {
                        balance: user.wallet_balance,
                        currency: 'PLN',
                        //formattedBalance: `${user.wallet_balance.toFixed(2)} PLN`
                    },
                    photo: user.photo,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            }
        });

    } catch (error) {
        console.error('Błąd pobierania profilu:', error);
        const customError = new CustomError('Błąd podczas pobierania profilu użytkownika', 500);
        return next(customError);
    }
});
// Endpoint do sprawdzenia profilu użytkownika (chroniony)
exports.getProfile = asyncErrorHandler(async (req, res, next) => {
    log('Pobieranie profilu użytkownika:', req.user);
    try {
        // Pobierz najnowsze dane użytkownika z bazy
        const [users] = await pool.execute(`
            SELECT id, name, email, role, wallet_balance, photo, created_at, updated_at
            FROM users WHERE id = ?
        `, [req.user.id]);

        if (users.length === 0) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

        const user = users[0];

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    wallet: {
                        balance: user.wallet_balance,
                        currency: 'PLN',
                        //formattedBalance: `${user.wallet_balance.toFixed(2)} PLN`
                    },
                    photo: user.photo,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            }
        });

    } catch (error) {
        console.error('Błąd pobierania profilu:', error);
        const customError = new CustomError('Błąd podczas pobierania profilu użytkownika', 500);
        return next(customError);
    }
});

// Zmiana hasła (wymaga aktualnego hasła)
exports.changePassword = asyncErrorHandler(async (req, res, next) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    // Walidacja danych
    if (!currentPassword || !newPassword || !confirmPassword) {
        const error = new CustomError('Wszystkie pola są wymagane', 400);
        return next(error);
    }

    if (newPassword !== confirmPassword) {
        const error = new CustomError('Nowe hasła nie są identyczne', 400);
        return next(error);
    }

    if (newPassword.length < 8) {
        const error = new CustomError('Nowe hasło musi mieć co najmniej 8 znaków', 400);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Pobierz aktualne hasło użytkownika
        const [users] = await connection.execute(`
            SELECT password FROM users WHERE id = ?
        `, [userId]);

        if (users.length === 0) {
            const error = new CustomError('Użytkownik nie istnieje', 404);
            return next(error);
        }

        // Sprawdź aktualne hasło
        const isCurrentPasswordCorrect = await bcryptjs.compare(currentPassword, users[0].password);
        
        if (!isCurrentPasswordCorrect) {
            const error = new CustomError('Aktualne hasło jest nieprawidłowe', 401);
            return next(error);
        }

        // Hashuj nowe hasło
        const hashedNewPassword = await bcryptjs.hash(newPassword, 12);

        // Aktualizuj hasło
        await connection.execute(`
            UPDATE users 
            SET password = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [hashedNewPassword, userId]);

        await connection.commit();

        // Generuj nowy token
        const token = signToken(userId);

        res.status(200).json({
            status: 'success',
            token,
            message: 'Hasło zostało pomyślnie zmienione'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd zmiany hasła:', error);
        const customError = new CustomError('Błąd podczas zmiany hasła', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});

// Reset hasła - generowanie tokenu
exports.forgotPassword = asyncErrorHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        const error = new CustomError('Podaj adres email', 400);
        return next(error);
    }

    try {
        // Znajdź użytkownika
        const [users] = await pool.execute(`
            SELECT id, name, email FROM users WHERE email = ?
        `, [email.toLowerCase()]);

        if (users.length === 0) {
            const error = new CustomError('Nie ma użytkownika z tym adresem email', 404);
            return next(error);
        }

        // Generuj token resetowania
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minut

        // Zapisz token w bazie
        await pool.execute(`
            UPDATE users 
            SET password_reset_token = ?, password_reset_expires = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [hashedResetToken, resetTokenExpires, users[0].id]);

        // W rzeczywistej aplikacji tutaj wysłałbyś email z linkiem resetowania
        console.log('Reset token:', resetToken);

        res.status(200).json({
            status: 'success',
            message: 'Token resetowania hasła został wysłany na email',
            // W wersji produkcyjnej usuń poniższą linię!
            resetToken: resetToken
        });

    } catch (error) {
        console.error('Błąd generowania tokenu resetowania:', error);
        const customError = new CustomError('Błąd podczas generowania tokenu resetowania', 500);
        return next(customError);
    }
});

// Reset hasła - używanie tokenu
exports.resetPassword = asyncErrorHandler(async (req, res, next) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
        const error = new CustomError('Wszystkie pola są wymagane', 400);
        return next(error);
    }

    if (newPassword !== confirmPassword) {
        const error = new CustomError('Hasła nie są identyczne', 400);
        return next(error);
    }

    if (newPassword.length < 8) {
        const error = new CustomError('Hasło musi mieć co najmniej 8 znaków', 400);
        return next(error);
    }

    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Hashuj token i znajdź użytkownika
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        
        const [users] = await connection.execute(`
            SELECT id, password_reset_expires 
            FROM users 
            WHERE password_reset_token = ? AND password_reset_expires > NOW()
        `, [hashedToken]);

        if (users.length === 0) {
            const error = new CustomError('Token jest nieprawidłowy lub wygasł', 400);
            return next(error);
        }

        // Hashuj nowe hasło
        const hashedNewPassword = await bcryptjs.hash(newPassword, 12);

        // Aktualizuj hasło i usuń token resetowania
        await connection.execute(`
            UPDATE users 
            SET 
                password = ?, 
                password_reset_token = NULL, 
                password_reset_expires = NULL,
                password_changed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [hashedNewPassword, users[0].id]);

        await connection.commit();

        // Generuj token logowania
        const loginToken = signToken(users[0].id);

        res.status(200).json({
            status: 'success',
            token: loginToken,
            message: 'Hasło zostało pomyślnie zresetowane'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Błąd resetowania hasła:', error);
        const customError = new CustomError('Błąd podczas resetowania hasła', 500);
        return next(customError);
    } finally {
        connection.release();
    }
});