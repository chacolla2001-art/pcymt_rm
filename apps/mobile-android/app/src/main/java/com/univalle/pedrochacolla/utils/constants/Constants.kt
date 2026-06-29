package com.univalle.pedrochacolla.utils.constants

import com.univalle.pedrochacolla.BuildConfig

/**
 * Application constants
 * Centralized configuration values
 *
 * All API endpoints must match the backend routes defined in:
 * apps/backend/src/api/routes/v1/
 */
object Constants {
    // ═══════════════════════════════════════════════════════════════
    // BASE CONFIGURATION (from BuildConfig - defined in build.gradle.kts)
    // ═══════════════════════════════════════════════════════════════
    const val URL_BASE = BuildConfig.BASE_URL
    // WEB_CLIENT_ID is now fetched from backend via ConfigManager

    // ═══════════════════════════════════════════════════════════════
    // AUTH ENDPOINTS (/api/auth)
    // ═══════════════════════════════════════════════════════════════
    object Auth {
        const val LOGIN = "/api/auth/login"
        const val REGISTER = "/api/auth/register"
        const val GOOGLE = "/api/auth/google"
        const val LOGOUT = "/api/auth/logout"
        const val ME = "/api/auth/me"
    }

    // ═══════════════════════════════════════════════════════════════
    // USER ENDPOINTS (/api/users)
    // ═══════════════════════════════════════════════════════════════
    object Users {
        const val BASE = "/api/users"
        const val REGISTER = "/api/users/register"
        const val CHECK_EMAIL = "/api/users/check-email"
        const val CHECK_DOCUMENT = "/api/users/check-document"

        fun byId(id: String) = "/api/users/$id"
        fun profilePicture(id: String) = "/api/users/$id/profile-picture"
    }

    // ═══════════════════════════════════════════════════════════════
    // VIRTUAL ASSETS ENDPOINTS (/api/virtual-assets)
    // ═══════════════════════════════════════════════════════════════
    object VirtualAssets {
        const val BASE = "/api/virtual-assets"
        const val ACTIVE = "/api/virtual-assets/active"

        fun byId(id: String) = "/api/virtual-assets/$id"
    }

    // ═══════════════════════════════════════════════════════════════
    // LOCATION/ANCHOR POINTS ENDPOINTS (/api/anchor-points)
    // ═══════════════════════════════════════════════════════════════
    object Locations {
        const val BASE = "/api/anchor-points"
        const val ACTIVE = "/api/anchor-points/active"

        fun byId(id: String) = "/api/anchor-points/$id"
        fun byVirtualAsset(assetId: String) = "/api/anchor-points/animal/$assetId"
    }

    // ═══════════════════════════════════════════════════════════════
    // USER INTERACTIONS ENDPOINTS (/api/user-interactions)
    // ═══════════════════════════════════════════════════════════════
    object Interactions {
        const val BASE = "/api/user-interactions"

        fun byId(id: String) = "/api/user-interactions/$id"
        fun byUser(userId: String) = "/api/user-interactions/user/$userId"
        fun byVirtualAsset(assetId: String) = "/api/user-interactions/by-virtual-asset/$assetId"
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYTICS ENDPOINTS (/api/analytics)
    // ═══════════════════════════════════════════════════════════════
    object Analytics {
        const val USERS_BY_ROLE = "/api/analytics/users-by-role"
        const val ACTIVE_USERS = "/api/analytics/active-users"
        const val INTERACTIONS_BY_TYPE = "/api/analytics/interactions-by-type"
        const val ACTIVE_VIRTUAL_ASSETS = "/api/analytics/active-virtual-assets"
        const val LOCATIONS = "/api/analytics/locations"
        const val TOTALS = "/api/analytics/totals"
        const val TOP_VIRTUAL_ASSETS = "/api/analytics/top-virtual-assets"
        const val TOP_USERS = "/api/analytics/top-users"
    }

    // ═══════════════════════════════════════════════════════════════
    // REQUEST CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    const val REQUEST_TIMEOUT_SECONDS = 30L
    const val MAX_IMAGE_SIZE_MB = 2
    const val MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

    // ═══════════════════════════════════════════════════════════════
    // AR CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    object AR {
        // Model settings
        const val DEFAULT_MODEL_PATH = "models/cube.glb"
        const val DEFAULT_MODEL_SCALE = 0.5f
        const val DEFAULT_MODEL_CENTER_OFFSET = -0.5f

        // Quality monitoring
        const val QUALITY_UPDATE_INTERVAL_MS = 1000L

        // FAB animation durations
        const val FAB_SHOW_DURATION_MS = 300L
        const val FAB_HIDE_DURATION_MS = 200L

        // Transformation factors
        const val SCALE_FACTOR_UP = 1.1f
        const val SCALE_FACTOR_DOWN = 0.9f
        const val ROTATION_STEP_DEGREES = 15f

        // Description panel animation
        const val PANEL_ANIMATION_DURATION_MS = 200L
        const val PANEL_FINAL_Y_POSITION = 150f

        // Screenshot settings
        const val SCREENSHOT_FOLDER = "Pictures/ARCaptures"
        const val SCREENSHOT_FORMAT = "AR_Capture_%d.png"
    }

}
