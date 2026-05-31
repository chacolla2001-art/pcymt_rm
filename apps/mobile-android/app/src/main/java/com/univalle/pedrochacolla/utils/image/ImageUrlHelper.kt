package com.univalle.pedrochacolla.utils.image

import com.univalle.pedrochacolla.utils.constants.Constants

/**
 * Centralized helper for building authenticated image URLs.
 *
 * All server-stored images are now served through the protected
 * endpoint `/api/files/` instead of the old public `/uploads/` path.
 *
 * Glide is configured (via [AuthenticatedGlideModule]) to use the
 * authenticated OkHttpClient so Authorization headers are sent
 * automatically — no query-param tokens needed in the mobile app.
 *
 * @see com.univalle.pedrochacolla.utils.image.AuthenticatedGlideModule
 */
object ImageUrlHelper {

    /**
     * Build a full, absolute URL ready for Glide from a server-relative
     * path such as `/api/files/bear.png` or legacy `/uploads/bear.png`.
     *
     * External URLs (http/https) are returned as-is (e.g. Google avatars).
     *
     * @param relativePath The path returned by the API (may be null/blank).
     * @return Full URL string, or `null` when input is blank.
     */
    fun buildUrl(relativePath: String?): String? {
        if (relativePath.isNullOrBlank()) return null

        // External URL — return untouched
        if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
            return relativePath
        }

        // Normalise legacy /uploads/ paths → /api/files/
        val normalised = if (relativePath.startsWith("/uploads/")) {
            relativePath.replaceFirst("/uploads/", "/api/files/")
        } else {
            relativePath
        }

        return Constants.URL_BASE + normalised
    }
}
