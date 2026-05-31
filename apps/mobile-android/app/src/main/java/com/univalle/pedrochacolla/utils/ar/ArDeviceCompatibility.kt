package com.univalle.pedrochacolla.utils.ar

import android.content.Context
import android.os.Build
import com.google.ar.core.ArCoreApk
import timber.log.Timber

/**
 * Determines whether the current device is capable of running the AR experience
 * with Google ARCore + SceneView cloud anchors at an acceptable quality level.
 *
 * The check is two-layered:
 *   1. **ARCore runtime availability** — queries [ArCoreApk] to see if the
 *      device has a working ARCore installation (or can install one).
 *   2. **Device allowlist** — even among ARCore-supported devices, only a curated
 *      set of chipset families / device models are known to deliver smooth
 *      SceneView 2.x performance with cloud anchors. Devices not on this list
 *      are directed to a fallback informational fragment.
 *
 * To add a new device, append its [Build.MODEL] (or a prefix) to
 * [VERIFIED_MODEL_PREFIXES], or its chipset family keyword to
 * [VERIFIED_CHIPSET_KEYWORDS].
 *
 * All checks are synchronous and safe to call on the main thread.
 */
object ArDeviceCompatibility {

    // ═══════════════════════════════════════════════════════════════
    // VERIFIED DEVICE MODELS  (Build.MODEL prefixes, case-insensitive)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Curated list of device model prefixes whose AR experience is verified.
     * Matching is case-insensitive, using [String.startsWith].
     *
     * Sources:
     *  - Google ARCore supported devices list
     *  - Internal QA testing results
     *  - Community-reported stable devices
     */
    private val VERIFIED_MODEL_PREFIXES = listOf(
        // ── Samsung Galaxy S series (flagships) ──
        "SM-S91",   // Galaxy S24 series (S24, S24+, S24 Ultra)
        "SM-S92",   // Galaxy S25 series (S25, S25+, S25 Ultra)
        "SM-S90",   // Galaxy S23 series
        "SM-S90",   // Galaxy S23 series
        "SM-S80",   // Galaxy S22 series (S8xx)
        "SM-G99",   // Galaxy S21 series
        "SM-G98",   // Galaxy S20 series
        "SM-G97",   // Galaxy S10 series
        "SM-G96",   // Galaxy S9 series

        // ── Samsung Galaxy Note series ──
        "SM-N98",   // Galaxy Note 20
        "SM-N97",   // Galaxy Note 10
        "SM-N96",   // Galaxy Note 9

        // ── Samsung Galaxy A series (mid-range verified) ──
        "SM-A556",  // Galaxy A55
        "SM-A546",  // Galaxy A54
        "SM-A536",  // Galaxy A53
        "SM-A526",  // Galaxy A52 5G
        "SM-A346",  // Galaxy A34
        "SM-A256",  // Galaxy A25

        // ── Samsung Galaxy Z (foldables) ──
        "SM-F94",   // Galaxy Z Fold 5
        "SM-F93",   // Galaxy Z Fold 4
        "SM-F72",   // Galaxy Z Flip 5
        "SM-F71",   // Galaxy Z Flip 4

        // ── Google Pixel ──
        "Pixel 9",
        "Pixel 8",
        "Pixel 7",
        "Pixel 6",
        "Pixel 5",
        "Pixel 4",

        // ── OnePlus ──
        "LE2",      // OnePlus 9 series
        "NE2",      // OnePlus 10 series
        "CPH25",    // OnePlus 11/12
        "IN20",     // OnePlus 8 series

        // ── Xiaomi / Redmi / POCO (flagships) ──
        "2304",     // Xiaomi 13 series
        "2311",     // Xiaomi 14 series
        "23049",    // Redmi Note 12 Pro
        "23076",    // Redmi Note 12
        "220",      // Xiaomi 12 series
        "M2012",    // Xiaomi Mi 11 series
        "22071",    // POCO F4
        "23013",    // POCO X5 Pro

        // ── Motorola ──
        "motorola edge",
        "moto g84",
        "moto g73",
        "moto g54",

        // ── Sony Xperia ──
        "XQ-D",     // Xperia 1 V / 5 V
        "XQ-C",     // Xperia 1 IV / 5 IV
        "XQ-B",     // Xperia 1 III / 5 III

        // ── Huawei (with GMS/ARCore support) ──
        "VOG-L29",  // P30 Pro
        "ELS-N",    // P40 Pro

        // ── OPPO / Realme ──
        "CPH2",     // OPPO Find / Reno series
        "RMX36",    // Realme GT series
        "RMX35",    // Realme 9 Pro+

        // ── Nothing ──
        "A063",     // Nothing Phone (1)
        "A065",     // Nothing Phone (2)
    )

    // ═══════════════════════════════════════════════════════════════
    // VERIFIED CHIPSET FAMILIES  (Hardware substring match)
    // ═══════════════════════════════════════════════════════════════

    /**
     * If [Build.HARDWARE] or [Build.BOARD] contains any of these substrings
     * (case-insensitive), the device is considered capable regardless of model.
     * This catches devices not explicitly listed above but running on a
     * known-good SoC platform.
     */
    private val VERIFIED_CHIPSET_KEYWORDS = listOf(
        // Qualcomm Snapdragon 8-series / 7-series
        "lahaina",   // Snapdragon 888
        "taro",      // Snapdragon 8 Gen 1
        "kalama",    // Snapdragon 8 Gen 2
        "pineapple", // Snapdragon 8 Gen 3
        "sun",       // Snapdragon 8 Elite (Gen 4)
        "crow",      // Snapdragon 7+ Gen 2
        "cape",      // Snapdragon 8+ Gen 1

        // Samsung Exynos
        "exynos",
        "s5e99",     // Exynos 2200+
        "s5e89",     // Exynos 1380/1480

        // Google Tensor
        "tensor",
        "gs101",     // Tensor G1
        "gs201",     // Tensor G2
        "zuma",      // Tensor G3
        "ripcurrent",// Tensor G4

        // MediaTek Dimensity flagships
        "mt689",     // Dimensity 9000+
        "mt688",     // Dimensity 8000+
    )

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    /**
     * Result of the device compatibility check.
     */
    enum class CompatibilityResult {
        /** Device is verified — AR can proceed normally. */
        COMPATIBLE,
        /** ARCore is available but device is not in the verified list. */
        DEVICE_NOT_VERIFIED,
        /** ARCore is not installed and cannot be installed. */
        ARCORE_NOT_AVAILABLE,
        /** ARCore availability could not be determined. */
        CHECK_FAILED
    }

    /**
     * Performs a full compatibility check for the AR experience.
     *
     * This is a **synchronous** call. ArCoreApk.checkAvailability() may in rare
     * cases need a network round-trip the first time, but on subsequent calls it
     * is cached and instant.
     *
     * @param context Application or Activity context
     * @return [CompatibilityResult] indicating the device status
     */
    fun checkCompatibility(context: Context): CompatibilityResult {
        return try {
            // Step 1 — ARCore runtime availability
            val availability = ArCoreApk.getInstance().checkAvailability(context)

            Timber.d("ARCore availability: %s | Model: %s | Board: %s | Hardware: %s",
                availability, Build.MODEL, Build.BOARD, Build.HARDWARE)

            when {
                availability.isSupported -> {
                    // Step 2 — Check device against verified list
                    if (isDeviceVerified()) {
                        Timber.i("AR compatible: %s (%s)", Build.MODEL, Build.HARDWARE)
                        CompatibilityResult.COMPATIBLE
                    } else {
                        Timber.w("ARCore supported but device not verified: %s (%s)",
                            Build.MODEL, Build.HARDWARE)
                        CompatibilityResult.DEVICE_NOT_VERIFIED
                    }
                }
                availability.isTransient -> {
                    // Transient state — ARCore is still checking; treat as compatible
                    // to avoid blocking on first launch. The ArFragment will handle
                    // session errors gracefully.
                    Timber.d("ARCore availability transient, assuming compatible")
                    if (isDeviceVerified()) CompatibilityResult.COMPATIBLE
                    else CompatibilityResult.DEVICE_NOT_VERIFIED
                }
                else -> {
                    Timber.w("ARCore NOT available on this device: %s", Build.MODEL)
                    CompatibilityResult.ARCORE_NOT_AVAILABLE
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to check ARCore compatibility")
            CompatibilityResult.CHECK_FAILED
        }
    }

    /**
     * Quick check: is the device in the verified list?
     * Does NOT check ARCore availability.
     */
    fun isDeviceVerified(): Boolean {
        val model = Build.MODEL.orEmpty()
        val hardware = Build.HARDWARE.orEmpty().lowercase()
        val board = Build.BOARD.orEmpty().lowercase()

        // Check model prefix
        val modelMatch = VERIFIED_MODEL_PREFIXES.any { prefix ->
            model.startsWith(prefix, ignoreCase = true)
        }
        if (modelMatch) return true

        // Check chipset keywords
        val chipsetMatch = VERIFIED_CHIPSET_KEYWORDS.any { keyword ->
            val kw = keyword.lowercase()
            hardware.contains(kw) || board.contains(kw)
        }
        return chipsetMatch
    }

    /**
     * Human-readable description of why the device is not compatible.
     * Used by the fallback fragment.
     */
    fun getIncompatibilityReason(result: CompatibilityResult): String {
        return when (result) {
            CompatibilityResult.COMPATIBLE -> ""
            CompatibilityResult.DEVICE_NOT_VERIFIED ->
                "Tu dispositivo (${Build.MANUFACTURER} ${Build.MODEL}) no ha sido verificado " +
                "para la experiencia de Realidad Aumentada. Para una experiencia óptima, " +
                "se requiere un dispositivo con soporte avanzado de ARCore y SceneView."
            CompatibilityResult.ARCORE_NOT_AVAILABLE ->
                "Google ARCore no está disponible en tu dispositivo " +
                "(${Build.MANUFACTURER} ${Build.MODEL}). La experiencia de Realidad " +
                "Aumentada requiere un dispositivo compatible con ARCore."
            CompatibilityResult.CHECK_FAILED ->
                "No se pudo verificar la compatibilidad de tu dispositivo con Realidad " +
                "Aumentada. Verifica tu conexión a internet e inténtalo de nuevo."
        }
    }
}
