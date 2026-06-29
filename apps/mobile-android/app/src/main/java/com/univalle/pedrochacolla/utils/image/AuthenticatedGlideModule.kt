package com.univalle.pedrochacolla.utils.image

import android.content.Context
import com.bumptech.glide.Glide
import com.bumptech.glide.GlideBuilder
import com.bumptech.glide.Registry
import com.bumptech.glide.annotation.GlideModule
import com.bumptech.glide.integration.okhttp3.OkHttpUrlLoader
import com.bumptech.glide.load.model.GlideUrl
import com.bumptech.glide.module.AppGlideModule
import com.univalle.pedrochacolla.data.remote.ApiClient
import java.io.InputStream

/**
 * Custom Glide module that routes ALL HTTP image requests through
 * [ApiClient.instance] — the OkHttpClient configured with [AuthInterceptor].
 *
 * This means every image loaded by Glide automatically carries the JWT
 * `Authorization: Bearer <token>` header required by the protected
 * `/api/files/` endpoint, without any per-call configuration.
 *
 * Registered via the `@GlideModule` annotation; KSP generates the
 * wiring at compile time.
 */
@GlideModule
class AuthenticatedGlideModule : AppGlideModule() {

    override fun registerComponents(context: Context, glide: Glide, registry: Registry) {
        // Replace the default HttpUrlConnection loader with OkHttp + AuthInterceptor
        registry.replace(
            GlideUrl::class.java,
            InputStream::class.java,
            OkHttpUrlLoader.Factory(ApiClient.instance)
        )
    }

    // Disable manifest parsing for a slight optimisation (we use annotation instead)
    override fun isManifestParsingEnabled(): Boolean = false
}
