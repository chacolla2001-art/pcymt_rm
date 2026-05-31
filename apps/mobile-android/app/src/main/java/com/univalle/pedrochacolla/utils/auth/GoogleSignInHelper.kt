package com.univalle.pedrochacolla.utils.auth
import android.app.Activity
import android.content.Context
import androidx.credentials.*
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.univalle.pedrochacolla.utils.config.ConfigManager
import java.util.concurrent.Executors
import timber.log.Timber

/**
 * Google Sign-In Helper using Credential Manager API
 * Fetches WEB_CLIENT_ID from ConfigManager (backend)
 */
class GoogleSignInHelper(
    private val context: Context,
    private val activity: Activity,
    private val onTokenReceived: (String) -> Unit,
    private val onError: (String) -> Unit
) {

    fun launch() {
        // Get WEB_CLIENT_ID from ConfigManager (fetched from backend)
        val webClientId = ConfigManager.getWebClientId()
        
        if (webClientId.isNullOrBlank()) {
            val initError = ConfigManager.getInitError()
            Timber.e("GoogleSignInHelper: WEB_CLIENT_ID not available. InitError: $initError")
            onError(
                "No se pudo obtener la configuración de Google.\n\n" +
                "Verifica tu conexión a internet y que el servidor esté disponible.\n\n" +
                if (initError != null) "Error: $initError" else "Reinicia la app e intenta de nuevo."
            )
            return
        }

        Timber.d("GoogleSignInHelper: Using webClientId=${webClientId.take(30)}...")

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(webClientId)
            .setAutoSelectEnabled(false)
            .setNonce(java.util.UUID.randomUUID().toString())
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val credentialManager = CredentialManager.create(context)
        val executor = Executors.newSingleThreadExecutor()

        credentialManager.getCredentialAsync(
            activity,
            request,
            null,
            executor,
            object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
                override fun onResult(result: GetCredentialResponse) {
                    val credential = result.credential
                    when {
                        credential is GoogleIdTokenCredential -> {
                            activity.runOnUiThread {
                                onTokenReceived(credential.idToken)
                            }
                        }
                        credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL -> {
                            try {
                                val googleCredential = GoogleIdTokenCredential.createFrom(credential.data)
                                activity.runOnUiThread {
                                    onTokenReceived(googleCredential.idToken)
                                }
                            } catch (e: GoogleIdTokenParsingException) {
                                Timber.e(e, "GoogleSignInHelper: Failed to parse Google ID token")
                                activity.runOnUiThread {
                                    onError("Error al procesar la credencial de Google")
                                }
                            }
                        }
                        else -> {
                            Timber.e("GoogleSignInHelper: Unknown credential type: ${credential.type}")
                            activity.runOnUiThread {
                                onError("Credencial inválida")
                            }
                        }
                    }
                }

                override fun onError(e: GetCredentialException) {
                    Timber.e(e, "GoogleSignInHelper: Credential error")
                    activity.runOnUiThread {
                        val errorMessage = when {
                            e.message?.contains("cancelled by the user", ignoreCase = true) == true ||
                            e.message?.contains("user_canceled", ignoreCase = true) == true -> {
                                "Inicio de sesión cancelado por el usuario."
                            }
                            e.message?.contains("no credentials available", ignoreCase = true) == true ||
                            e.message?.contains("no account", ignoreCase = true) == true -> {
                                "No hay cuentas de Google disponibles.\n\n" +
                                "Verifica que:\n" +
                                "• Tienes una cuenta de Google configurada en tu dispositivo\n" +
                                "• Google Play Services está actualizado"
                            }
                            e.message?.contains("16", ignoreCase = true) == true ||
                            e.message?.contains("DEVELOPER_ERROR", ignoreCase = true) == true -> {
                                "Error de configuración (DEVELOPER_ERROR).\n\n" +
                                "Este error ocurre por:\n" +
                                "• El WEB_CLIENT_ID no coincide con Google Console\n" +
                                "• El SHA-1 del APK no está registrado\n" +
                                "• El paquete de la app no coincide\n\n" +
                                "Contacta al desarrollador con este código: ${e.message}"
                            }
                            e.message?.contains("network", ignoreCase = true) == true -> {
                                "Error de red.\n\n" +
                                "Verifica tu conexión a internet e intenta de nuevo."
                            }
                            e.message?.contains("sign_in_failed", ignoreCase = true) == true ||
                            e.message?.contains("12501", ignoreCase = true) == true -> {
                                "El inicio de sesión falló.\n\n" +
                                "Esto puede ocurrir si:\n" +
                                "• Cerraste el diálogo de selección de cuenta\n" +
                                "• Tu cuenta tiene restricciones\n" +
                                "• La app no está verificada por Google"
                            }
                            else -> {
                                "Error al iniciar sesión con Google.\n\n" +
                                "Código de error: ${e.javaClass.simpleName}\n" +
                                "Mensaje: ${e.message ?: "Sin detalles"}\n\n" +
                                "Intenta cerrar la app y volver a abrirla."
                            }
                        }
                        onError(errorMessage)
                    }
                }
            }
        )
    }
}
