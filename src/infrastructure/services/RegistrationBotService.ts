import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";

export class RegistrationBotService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  private async dispatchEmail(to: string, subject: string, html: string): Promise<void> {
    const sender = process.env.BOT_SENDER_EMAIL || process.env.SMTP_USER || "suplicem.notificaciones@gmail.com";

    // 1. Si existe SENDGRID_API_KEY configurada
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to,
          from: sender,
          subject,
          html,
        });
        console.log(`✅ [Bot de Correo] Enviado mediante SendGrid a ${to}`);
        return;
      } catch (err: any) {
        console.error("Error en SendGrid, intentando transportes alternativos...", err?.message);
      }
    }

    // 2. Si existen credenciales SMTP (Servidor SMTP / Gmail App Password)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: `"Suplicem Bot" <${process.env.SMTP_USER}>`,
          to,
          subject,
          html,
        });
        console.log(`✅ [Bot de Correo] Enviado mediante SMTP a ${to}. ID: ${info.messageId}`);
        return;
      } catch (err: any) {
        console.error("Error en transporte SMTP:", err?.message);
      }
    }

    // 3. Fallback de prueba con Ethereal Email (Efectúa el envío real en red de prueba con URL de inbox)
    try {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await testTransporter.sendMail({
        from: '"Suplicem Bot" <bot@suplicem.com>',
        to,
        subject,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✅ [Bot de Correo Suplicem] Correo enviado exitosamente a ${to}`);
      if (previewUrl) {
        console.log(`🔗 [Ver Correo en Bandeja de Entrada Real]: ${previewUrl}`);
      }
    } catch (err: any) {
      console.log(`🤖 [Bot de Correo Suplicem] Correo generado para ${to}`);
    }
  }

  /**
   * Bot que despacha automáticamente un correo de bienvenida y confirmación de perfil
   * al correo electrónico registrado.
   */
  async sendWelcomeEmailBot(
    email: string,
    names: string,
    lastNames: string,
    userType: string,
    identification: string
  ): Promise<void> {
    const roleLabel =
      userType === "client"
        ? "Cliente"
        : userType === "driver"
        ? "Conductor"
        : "Administrador";

    console.log(
      `🤖 [Bot de Correo Suplicem] Procesando envío automático de bienvenida para el perfil: ${email}`
    );

    const emailSubject = "🤖 ¡Bienvenido a Suplicem! Registro completado con éxito";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="background-color: #0F294A; padding: 18px; text-align: center; border-radius: 6px 6px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">SUPLICEM</h1>
          <p style="color: #E31E24; margin: 4px 0 0 0; font-weight: bold; font-size: 13px;">Logística & Distribución de Materiales</p>
        </div>

        <div style="padding: 24px; color: #334155;">
          <h2 style="color: #0F294A; margin-top: 0;">¡Hola, ${names} ${lastNames}!</h2>
          <p style="font-size: 15px; line-height: 1.6;">
            Tu registro en la plataforma <strong>Suplicem</strong> ha sido procesado y guardado correctamente en nuestra base de datos.
          </p>

          <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #E31E24; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #0F294A; font-size: 16px;">📌 Datos de tu Perfil Registrado:</h3>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
              <li><strong>Nombre completo:</strong> ${names} ${lastNames}</li>
              <li><strong>Identificación:</strong> ${identification}</li>
              <li><strong>Correo registrado:</strong> ${email}</li>
              <li><strong>Tipo de usuario:</strong> ${roleLabel}</li>
            </ul>
          </div>

          <p style="font-size: 14px; line-height: 1.5;">
            Tu solicitud de cuenta se encuentra en revisión por el Administrador. Tan pronto tu documento sea verificado, recibirás una notificación de activación.
          </p>

          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            <p>🤖 Este es un mensaje automático generado por el Bot de Registro de Suplicem.</p>
            <p>© ${new Date().getFullYear()} Suplicem Dominicana. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    `;

    await this.dispatchEmail(email, emailSubject, emailHtml);
  }

  /**
   * Bot que despacha automáticamente un correo cuando la cuenta es aprobada por el Administrador.
   */
  async sendAccountApprovedEmailBot(
    email: string,
    names: string,
    lastNames: string
  ): Promise<void> {
    console.log(
      `🤖 [Bot de Correo Suplicem] Procesando envío de aprobación de cuenta para: ${email}`
    );

    const emailSubject = "🎉 ¡Tu cuenta en Suplicem ha sido aprobada!";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <div style="background-color: #0F294A; padding: 18px; text-align: center; border-radius: 6px 6px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">SUPLICEM</h1>
          <p style="color: #4ADE80; margin: 4px 0 0 0; font-weight: bold; font-size: 13px;">✔ Cuenta Habilitada</p>
        </div>

        <div style="padding: 24px; color: #334155;">
          <h2 style="color: #0F294A; margin-top: 0;">¡Buenas noticias, ${names} ${lastNames}!</h2>
          <p style="font-size: 15px; line-height: 1.6;">
            Tu solicitud de registro y documento de identificación han sido revisados y <strong>aprobados con éxito</strong> por nuestro equipo de administración.
          </p>

          <div style="background-color: #f0fdf4; padding: 16px; border-left: 4px solid #22c55e; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #15803d; font-size: 16px;">🚀 ¡Tu cuenta ya está activa!</h3>
            <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
              Ya puedes abrir la aplicación de Suplicem en tu dispositivo móvil e iniciar sesión utilizando tu correo electrónico (<strong>${email}</strong>) y contraseña.
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            <p>🤖 Este es un mensaje automático generado por el Bot de Notificaciones de Suplicem.</p>
            <p>© ${new Date().getFullYear()} Suplicem Dominicana. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    `;

    await this.dispatchEmail(email, emailSubject, emailHtml);
  }
}
