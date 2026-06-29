package com.univalle.pedrochacolla.utils.image

import com.univalle.pedrochacolla.data.model.PredefinedAvatar

/**
 * Resuelve qué avatar predefinido coincide con una URL almacenada en BD.
 * Cubre rutas legacy (/uploads/, /api/files/bear.png) y sirena → reptile.png.
 */
object AvatarResolver {

    const val DEFAULT_AVATAR_PATH = "/api/files/model-icons/bear.png"

    private val LEGACY_BARE_ICONS = Regex(
        "^/api/files/(bear|cattle|chicken|cow|dog|horse|leopard|lizard|pig|tiger|viper|reptile|mermaid)\\.png$",
        RegexOption.IGNORE_CASE,
    )

    private val USER_SCOPED_AVATAR = Regex(
        "^/api/files/profile-pictures/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.webp$",
        RegexOption.IGNORE_CASE,
    )

    fun resolveSelectedId(avatarUrl: String?, avatars: List<PredefinedAvatar>): String? {
        if (avatarUrl.isNullOrBlank()) return null

        val normalized = normalizePath(avatarUrl)
        val fileName = normalized.substringAfterLast('/').substringBefore('?').lowercase()

        avatars.forEach { avatar ->
            val catalogFile = avatar.url.substringAfterLast('/').substringBefore('?').lowercase()
            if (fileName == catalogFile || normalized.contains("/${avatar.id}.png")) {
                return avatar.id
            }
        }

        return null
    }

    fun isCustomProfilePicture(path: String): Boolean {
        return normalizePath(path).startsWith("/api/files/profile-pictures/")
    }

    fun isUserScopedProfilePicture(path: String): Boolean {
        return USER_SCOPED_AVATAR.matches(normalizePath(path))
    }

    fun resolveDisplayPath(relativePath: String?): String {
        if (relativePath.isNullOrBlank()) return DEFAULT_AVATAR_PATH
        return normalizePath(relativePath)
    }

    fun normalizePath(relativePath: String): String {
        var path = relativePath.trim()

        if (path.startsWith("/uploads/")) {
            path = path.replaceFirst("/uploads/", "/api/files/")
        }

        path = path.replace("/api/files/avatars/", "/api/files/model-icons/")

        LEGACY_BARE_ICONS.matchEntire(path)?.let { match ->
            path = "/api/files/model-icons/${match.groupValues[1].lowercase()}.png"
        }

        return path
    }
}
