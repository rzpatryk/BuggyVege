const asyncErrorHandler = require('../../Utils/asyncErrorHandler');
const CustomError = require('../../Utils/CustomError');

class BaseAuthController {
    constructor(authService) {
        this.authService = authService;
    }

    register = asyncErrorHandler(async (req, res, next) => {
        try {
            const user = await this.authService.register(req.body);
        
            
            // Utwórz sesję
            req.session.userId = user.id;
            req.session.userRole = user.role;

            res.status(201).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    login = asyncErrorHandler(async (req, res, next) => {
        try {
            const { email, password } = req.body; // Pobierz dane bezpośrednio z req.body
            
            // Walidacja danych wejściowych
            if (!email || !password) {
                const error = new CustomError('Podaj email i hasło', 400);
                return next(error);
            }

            const user = await this.authService.login({ email, password });
            
            // Utwórz sesję
            req.session.userId = user.id;
            req.session.userRole = user.role;

            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 401);
            return next(customError);
        }
    });

    getProfile = asyncErrorHandler(async (req, res, next) => {
        try {
            const user = await this.authService.getUserById(req.user.id);
            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

    logout = asyncErrorHandler(async (req, res, next) => {
        req.session.destroy((err) => {
            if (err) {
                const error = new CustomError('Błąd podczas wylogowania', 500);
                return next(error);
            }
            
            res.clearCookie('connect.sid');
            res.status(200).json({
                status: 'success',
                message: 'Zostałeś pomyślnie wylogowany'
            });
        });
    });

    protect = asyncErrorHandler(async (req, res, next) => {
        if (!req.session || !req.session.userId) {
            const error = new CustomError('Nie jesteś zalogowany. Zaloguj się, aby uzyskać dostęp.', 401);
            return next(error);
        }

        try {
            const currentUser = await this.authService.getUserById(req.session.userId);
            
            if (!currentUser.active) {
                req.session.destroy();
                const error = new CustomError('Konto zostało dezaktywowane', 401);
                return next(error);
            }

            req.user = {
                id: currentUser.id,
                role: currentUser.role
            };
            
            next();
        } catch (error) {
            const customError = new CustomError('Błąd podczas weryfikacji sesji', 500);
            return next(customError);
        }
    });

    restrict = (...allowedRoles) => {
        return asyncErrorHandler(async (req, res, next) => {
            // Sprawdź czy użytkownik jest zalogowany
            if (!req.user) {
                const error = new CustomError('Brak autoryzacji. Użyj middleware protect przed restrict.', 500);
                return next(error);
            }

            // Sprawdź czy rola użytkownika jest w dozwolonych rolach
            if (!allowedRoles.includes(req.user.role)) {
                const error = new CustomError('Nie masz uprawnień do wykonania tej operacji', 403);
                return next(error);
            }

            next();
        });
    };

    changePassword = asyncErrorHandler(async (req, res, next) => {
        try {
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

            // Przekaż currentPassword jako oldPassword
            const result = await this.authService.changePassword(userId, currentPassword, newPassword);
            
            res.status(200).json({
                status: 'success',
                message: result.message
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    forgotPassword = asyncErrorHandler(async (req, res, next) => {
        try {
            const { email } = req.body;

            if (!email) {
                const error = new CustomError('Podaj adres email', 400);
                return next(error);
            }

            const result = await this.authService.forgotPassword(email);

            res.status(200).json({
                status: 'success',
                message: result.message,
                // W produkcji usuń poniższą linię!
                resetToken: result.resetToken
            });
        } catch (error) {
            const customError = new CustomError(error.message, 404);
            return next(customError);
        }
    });

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

            // Utwórz sesję dla użytkownika po resecie hasła
            req.session.userId = result.userId;

            res.status(200).json({
                status: 'success',
                message: result.message
            });
        } catch (error) {
            const customError = new CustomError(error.message, 400);
            return next(customError);
        }
    });

    
}

module.exports = BaseAuthController;