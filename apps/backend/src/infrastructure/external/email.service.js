const nodemailer = require('nodemailer');
const logger = require('../../shared/utils/logger.util');
const env = require('../../config/env');

/**
 * Email service for sending emails
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.emailUser = env.emailUser;
    this.emailFrom = env.emailFrom || this.emailUser;
    this.#initTransporter();
  }

  #initTransporter() {
    // Prefer OAuth2 if configured
    if (env.emailOauthRefreshToken && env.emailOauthClientId && env.emailOauthClientSecret) {
      logger.info('EmailService: initializing transporter with OAuth2');
      this.transporter = nodemailer.createTransport({
        service: env.emailService || 'Gmail',
        connectionTimeout: env.emailConnectionTimeout,
        greetingTimeout: env.emailGreetingTimeout,
        socketTimeout: env.emailSocketTimeout,
        auth: {
          type: 'OAuth2',
          user: this.emailUser,
          clientId: env.emailOauthClientId,
          clientSecret: env.emailOauthClientSecret,
          refreshToken: env.emailOauthRefreshToken,
          accessToken: env.emailOauthAccessToken || undefined,
        },
      });
      return;
    }

    // If explicit SMTP host/port provided, use it
    if (env.emailHost && env.emailPort) {
      logger.info('EmailService: initializing transporter with SMTP host/port');
      this.transporter = nodemailer.createTransport({
        host: env.emailHost,
        port: 465,
        secure: true,
        connectionTimeout: env.emailConnectionTimeout,
        greetingTimeout: env.emailGreetingTimeout,
        socketTimeout: env.emailSocketTimeout,
        auth: this.emailUser && env.emailPass ? { user: this.emailUser, pass: env.emailPass } : undefined,
        tls: {
          rejectUnauthorized: false,
        },
      });
      return;
    }

    // Fallback to service + user/pass (Gmail)
    if (!this.emailUser || !env.emailPass) {
      logger.warn('Email credentials not configured. Email sending will be disabled.');
      return;
    }

    logger.info('EmailService: initializing transporter with service (user/pass)');
    this.transporter = nodemailer.createTransport({
      service: env.emailService || 'Gmail',
      connectionTimeout: env.emailConnectionTimeout,
      greetingTimeout: env.emailGreetingTimeout,
      socketTimeout: env.emailSocketTimeout,
      auth: {
        user: this.emailUser,
        pass: env.emailPass,
      },
    });
  }

  /**
   * Check if email service is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.transporter !== null;
  }

  /**
   * Send an email
   * @param {object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text body
   * @param {string} options.html - HTML body (optional)
   */
  async send({ to, subject, text, html }) {
    if (!this.isConfigured()) {
      logger.warn('Email service not configured, skipping email send');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        text,
        html,
      });
      logger.info('Email sent successfully', { to });
      return true;
    } catch (error) {
      logger.error('Error sending email', { to, error: error.message });
      throw error;
    }
  }

  /**
   * Send password recovery email
   * @param {string} email - Recipient email
   * @param {string} newPassword - New temporary password
   */
  async sendPasswordRecovery(email, newPassword) {
    return this.send({
      to: email,
      subject: 'Recuperación de Contraseña - Parque de las Culturas y la Madre Tierra',
      text: `Recibiste este correo porque solicitaste recuperar tu contraseña. Tu nueva contraseña temporal es: ${newPassword}. Ingresa con esta contraseña desde la aplicación móvil y cámbiala cuanto antes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5e35b1;">Parque de las Culturas y la Madre Tierra</h2>
          <h3>Recuperación de Contraseña</h3>
          <p>Recibiste este correo porque solicitaste recuperar tu contraseña.</p>
          <p>Tu nueva contraseña temporal es:</p>
          <p style="font-size: 20px; font-weight: bold; background: #f5f5f5; padding: 12px; border-radius: 6px; letter-spacing: 2px;">${newPassword}</p>
          <p>Ingresa con esta contraseña desde la aplicación móvil y cámbiala cuanto antes desde tu perfil.</p>
          <hr style="border: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Si no solicitaste recuperar tu contraseña, por favor ignora este mensaje.</p>
        </div>
      `,
    });
  }

  /**
   * Send account created confirmation email (for self-registered users)
   * @param {string} email - Recipient email
   * @param {string} username - Username
   */
  async sendAccountCreated(email, username) {
    return this.send({
      to: email,
      subject: 'Registro de cuenta en PCyMT RM',
      text: `Hola, ${username}. Se creó una cuenta en PCyMT RM usando este correo electrónico. Si realizaste este registro, revisa tu bandeja de entrada y verifica tu correo para activar el acceso. Si no fuiste tú, ignora este mensaje.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5e35b1;">Parque de las Culturas y la Madre Tierra</h2>
          <h3>Registro de cuenta</h3>
          <p>Hola, ${username}.</p>
          <p>Se creó una cuenta en PCyMT RM usando este correo electrónico.</p>
          <p>Si realizaste este registro, revisa tu bandeja de entrada y verifica tu correo para activar el acceso.</p>
          <hr style="border: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Si no fuiste tú, ignora este mensaje.</p>
        </div>
      `,
    });
  }

  async sendEmailVerification(email, username, verificationUrl) {
    return this.send({
      to: email,
      subject: 'Verifica tu correo - PCyMT RM',
      text: `Hola, ${username}. Verifica tu correo abriendo este enlace: ${verificationUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5e35b1;">Parque de las Culturas y la Madre Tierra</h2>
          <h3>Verifica tu correo</h3>
          <p>Hola, ${username}.</p>
          <p>Para activar tu cuenta, verifica tu correo haciendo clic en el siguiente botón:</p>
          <p style="margin: 24px 0;">
            <a href="${verificationUrl}" style="background:#5e35b1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Verificar correo</a>
          </p>
          <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <hr style="border: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Si no realizaste este registro, ignora este mensaje.</p>
        </div>
      `,
    });
  }

  async sendGoogleAccountCreated(email, username) {
    return this.send({
      to: email,
      subject: 'Cuenta creada con Google - PCyMT RM',
      text: `Hola, ${username}. Tu cuenta en PCyMT RM fue creada usando Google. Si fuiste tú, ya puedes ingresar a la aplicación. Si no fuiste tú, ignora este mensaje.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5e35b1;">Parque de las Culturas y la Madre Tierra</h2>
          <h3>Cuenta creada con Google</h3>
          <p>Hola, ${username}.</p>
          <p>Tu cuenta en PCyMT RM fue creada usando Google.</p>
          <p>Si fuiste tú, ya puedes ingresar a la aplicación móvil.</p>
          <hr style="border: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Si no fuiste tú, ignora este mensaje.</p>
        </div>
      `,
    });
  }

  async sendAccountDeleted(email, username) {
    return this.send({
      to: email,
      subject: 'Tu cuenta fue eliminada - PCyMT RM',
      text: `Hola, ${username}. Tu cuenta en PCyMT RM fue eliminada. Si realizaste esta acción, no necesitas hacer nada más. Si no fuiste tú, comunícate con soporte.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5e35b1;">Parque de las Culturas y la Madre Tierra</h2>
          <h3>Cuenta eliminada</h3>
          <p>Hola, ${username}.</p>
          <p>Tu cuenta en PCyMT RM fue eliminada.</p>
          <p>Si realizaste esta acción, no necesitas hacer nada más.</p>
          <hr style="border: 1px solid #eee;" />
          <p style="color: #888; font-size: 12px;">Si no fuiste tú, comunícate con soporte.</p>
        </div>
      `,
    });
  }

  /**
   * Send welcome email with password
   * @param {string} email - Recipient email
   * @param {string} password - Generated password
   */
  async sendWelcome(email, password) {
    return this.send({
      to: email,
      subject: 'Bienvenido - Credenciales de Acceso',
      text: `Bienvenido! Su contraseña temporal es: ${password}`,
      html: `
        <h2>¡Bienvenido!</h2>
        <p>Su cuenta ha sido creada exitosamente.</p>
        <p>Su contraseña temporal es: <strong>${password}</strong></p>
        <p>Le recomendamos cambiar esta contraseña después de iniciar sesión.</p>
      `,
    });
  }
}

module.exports = EmailService;
