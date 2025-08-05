const BaseAuthController = require('../BaseControllers/BaseAuthController');
const MongoAdapter = require('../Database/AuthAdapters/MongoAdapter');
const AuthService = require('../Services/authService');
const jwt = require('jsonwebtoken');
const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');

class MongoJWTAuthController extends BaseAuthController {
    constructor() {
        const dbAdapter = new MongoAdapter();
        const authService = new AuthService(dbAdapter);
        super(authService);
    }

    // Przesłaniamy metodę login dla JWT
    login = asyncErrorHandler(async (req, res, next) => {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                const error = new CustomError('Podaj email i hasło', 400);
                return next(error);
            }

            const user = await this.authService.login({ email, password });
            
            // Generuj JWT token zamiast sesji
            const token = this.signToken(user.id);

            res.status(200).json({
                status: 'success',
                token,
                data: { user }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 401);
            return next(customError);
        }
    });

    // Przesłaniamy metodę register dla JWT
    register = asyncErrorHandler(async (req, res, next) => {
        try {
            const user = await this.authService.register(req.body);
            
            // Generuj JWT token zamiast sesji
            const token = this.signToken(user.id);

            res.status(201).json({
                status: 'success',
                token,
                data: { user }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    // Przesłaniamy metodę protect dla JWT
    protect = asyncErrorHandler(async (req, res, next) => {
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
            const currentUser = await this.authService.getUserById(decoded.id);
            
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

            req.user = {
                id: currentUser.id,
                role: currentUser.role
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
            
            const customError = new CustomError('Błąd podczas weryfikacji tokenu', 500);
            return next(customError);
        }
    });

    // Przesłaniamy metodę logout dla JWT
    logout = asyncErrorHandler(async (req, res, next) => {
        // Dla JWT nie możemy "wylogować" tokenu po stronie serwera
        // Klient musi usunąć token ze swojej strony
        res.status(200).json({
            status: 'success',
            message: 'Zostałeś pomyślnie wylogowany. Usuń token z aplikacji klienckiej.'
        });
    });

    // Przesłaniamy metodę resetPassword dla JWT
    resetPassword = asyncErrorHandler(async (req, res, next) => {
        try {
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

            const result = await this.authService.resetPassword(token, newPassword);

            // Generuj nowy JWT token po resecie hasła
            const loginToken = this.signToken(result.userId);

            res.status(200).json({
                status: 'success',
                token: loginToken,
                message: result.message
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    // Pomocnicza metoda do generowania JWT
    signToken(id) {
        return jwt.sign({ id }, process.env.SECRET_STR, {
            expiresIn: process.env.LOGIN_EXPIRES
        });
    }
}

module.exports = MongoJWTAuthController;