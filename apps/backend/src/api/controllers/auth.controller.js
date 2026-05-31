const { ResponseUtil } = require('../../shared/utils');

/**
 * Auth Controller - Authentication HTTP handlers
 */
class AuthController {
  constructor(authService, userService, googleAuthService, emailService) {
    this.authService = authService;
    this.userService = userService;
    this.googleAuthService = googleAuthService;
    this.emailService = emailService;
  }

  /**
   * Login with email and password
   * POST /api/auth/login
   */
  login = async (req, res, next) => {
    try {
      const { email, password, platform } = req.body;
      const result = await this.authService.login({ email, password, platform });

      return ResponseUtil.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login with Google
   * POST /api/auth/google
   */
  googleLogin = async (req, res, next) => {
    try {
      // Accept 'token', 'id_token', and 'idToken' (mobile sends idToken)
      const token = req.body.token || req.body.id_token || req.body.idToken;

      // Security: Use logger instead of console for production safety
      const logger = require('../../shared/utils/logger.util');
      logger.debug('Google login request received', {
        hasToken: !!req.body.token,
        hasIdToken: !!req.body.id_token,
        hasIdTokenCamel: !!req.body.idToken,
        tokenPresent: !!token,
      });

      if (!token) {
        return ResponseUtil.error(res, 'Token is required (send as "token", "id_token", or "idToken")', 400);
      }

      if (!this.googleAuthService.isConfigured()) {
        return ResponseUtil.error(res, 'Google authentication is not configured', 503);
      }

      const result = await this.authService.loginWithGoogle(
        token,
        this.googleAuthService,
        this.userService,
      );

      return ResponseUtil.success(res, result, 'Google login successful');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout
   * POST /api/auth/logout
   */
  logout = async (req, res, next) => {
    try {
      const sessionId = req.body.sessionId;
      await this.authService.logout(sessionId);

      return ResponseUtil.success(res, null, 'Logout successful');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user info
   * GET /api/auth/me
   */
  getCurrentUser = async (req, res, next) => {
    try {
      if (!req.user) {
        return ResponseUtil.error(res, 'Not authenticated', 401);
      }

      const user = await this.userService.getById(req.user.id);
      return ResponseUtil.success(res, user, 'User info retrieved');
    } catch (error) {
      next(error);
    }
  };

  resendVerificationEmail = async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await this.userService.getByEmailAny(email);

      if (user && !user.google_id && !user.email_verified_at) {
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const verifyBaseUrl = `${protocol}://${req.get('host')}/api/auth/verify-email`;
        await this.authService.sendEmailVerification(user, this.emailService, verifyBaseUrl);
      }

      return ResponseUtil.success(res, null, 'If the account exists, a verification email has been sent');
    } catch (error) {
      next(error);
    }
  };

  checkEmailVerification = async (req, res, next) => {
    try {
      const { email } = req.body;
      const verified = await this.userService.isEmailVerified(email);
      return ResponseUtil.success(res, { verified }, 'Verification status retrieved');
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).send('<h1>Enlace inválido</h1><p>Falta el token de verificación.</p>');
      }

      await this.authService.verifyEmail(token, this.userService);

      return res.status(200).send(`
        <html lang="es">
          <head><meta charset="utf-8"><title>Correo verificado</title></head>
          <body style="font-family:Arial,sans-serif;padding:32px;max-width:640px;margin:0 auto;">
            <h1>Correo verificado correctamente</h1>
            <p>Ya puedes volver a la aplicación móvil y actualizar el estado de verificación.</p>
          </body>
        </html>
      `);
    } catch (error) {
      if (error.message?.includes('email verification token')) {
        return res.status(400).send(`
          <html lang="es">
            <head><meta charset="utf-8"><title>Enlace inválido</title></head>
            <body style="font-family:Arial,sans-serif;padding:32px;max-width:640px;margin:0 auto;">
              <h1>El enlace ya no es válido</h1>
              <p>Solicita un nuevo correo de verificación desde la aplicación.</p>
            </body>
          </html>
        `);
      }
      next(error);
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refreshToken = async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return ResponseUtil.error(res, 'Refresh token is required', 400);
      }

      const result = await this.authService.refreshToken(refreshToken);

      return ResponseUtil.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  };
  /**
   * Request password recovery
   * POST /api/auth/forgot-password
   */
  forgotPassword = async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        return ResponseUtil.error(res, 'El correo electrónico es obligatorio', 400);
      }
      await this.authService.forgotPassword(email, this.emailService);
      // Always return success to avoid user enumeration
      return ResponseUtil.success(res, null, 'Si el correo existe, se enviará una contraseña temporal');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AuthController;
