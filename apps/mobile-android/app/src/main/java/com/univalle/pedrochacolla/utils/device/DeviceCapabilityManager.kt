package com.univalle.pedrochacolla.utils.device

import android.content.Context
import com.univalle.pedrochacolla.utils.ar.ArDeviceCompatibility
import timber.log.Timber

/**
 * DeviceCapabilityManager — Classifies devices as HIGH_END or LOW_END
 * for the purpose of selecting the appropriate AR experience.
 *
 * ## Criterio de clasificación
 *
 * **HIGH_END (Gama Alta)** — Realidad Mixta disponible:
 *   - El dispositivo está en la lista verificada de ARDeviceCompatibility
 *   - ARCore está instalado y funcional
 *   - El chipset pertenece a una familia de alto rendimiento conocida
 *   - Resultado: `ArDeviceCompatibility.CompatibilityResult.COMPATIBLE`
 *
 * **LOW_END (Gama Baja)** — Solo modo Mapa Explorador disponible:
 *   - `DEVICE_NOT_VERIFIED`: Tiene ARCore instalado pero el dispositivo NO está
 *     en la lista de verificados. Esto incluye celulares que tienen soporte básico
 *     de ARCore pero carecen de Depth API, procesamiento de planos de alta calidad,
 *     o GPU suficiente para SceneView + cloud anchors en tiempo real.
 *   - `ARCORE_NOT_AVAILABLE`: ARCore no está disponible en el dispositivo.
 *   - `CHECK_FAILED`: No se pudo determinar la compatibilidad.
 *
 * ## Razonamiento técnico
 * Un dispositivo puede "soportar ARCore" en nivel básico (planos simples, hitTest),
 * pero la experiencia de Realidad Mixta con cloud anchors, SceneView 2.x y modelos
 * GLB requiere:
 *   - Depth API (LiDAR o stereo depth) para anclaje preciso
 *   - GPU de al menos Adreno 640+ o equivalente para SceneView
 *   - CPU rápida para procesamiento de feature maps y VPS data
 * Dispositivos fuera de la allowlist verificada probablemente carecen de uno o más
 * de estos requisitos → se dirigen al modo Mapa Explorador (Pokémon Go style).
 */
object DeviceCapabilityManager {

    enum class DeviceTier {
        /**
         * Dispositivo de gama alta — Realidad Mixta (cloud anchors) disponible.
         * También puede usar el modo Mapa Explorador.
         */
        HIGH_END,

        /**
         * Dispositivo de gama baja — Solo el modo Mapa Explorador disponible.
         * La Realidad Mixta está deshabilitada.
         */
        LOW_END
    }

    private var cachedTier: DeviceTier? = null

    /**
     * Determina la categoría del dispositivo (HIGH_END o LOW_END).
     * El resultado se cachea para el ciclo de vida de la aplicación.
     *
     * @param context Contexto de la aplicación o actividad.
     * @return [DeviceTier] correspondiente al dispositivo.
     */
    fun getDeviceTier(context: Context): DeviceTier {
        return cachedTier ?: classify(context).also { cachedTier = it }
    }

    /**
     * Retorna true si el dispositivo es HIGH_END (puede usar Realidad Mixta).
     */
    fun isHighEnd(context: Context): Boolean = getDeviceTier(context) == DeviceTier.HIGH_END

    /**
     * Retorna true si el dispositivo es LOW_END (solo Mapa Explorador).
     */
    fun isLowEnd(context: Context): Boolean = getDeviceTier(context) == DeviceTier.LOW_END

    /**
     * Descripción legible del criterio para el dispositivo actual.
     * Útil para debugging y para mostrar al usuario.
     */
    fun getTierDescription(context: Context): String {
        return when (getDeviceTier(context)) {
            DeviceTier.HIGH_END ->
                "Dispositivo de gama alta — Realidad Mixta disponible"
            DeviceTier.LOW_END -> {
                val arResult = ArDeviceCompatibility.checkCompatibility(context)
                when (arResult) {
                    ArDeviceCompatibility.CompatibilityResult.DEVICE_NOT_VERIFIED ->
                        "Dispositivo con ARCore básico — sin Depth API verificada. " +
                        "Usa Juku Go para descubrir animales."
                    ArDeviceCompatibility.CompatibilityResult.ARCORE_NOT_AVAILABLE ->
                        "ARCore no disponible en este dispositivo. " +
                        "Usa Juku Go para descubrir animales."
                    else ->
                        "No se pudo verificar compatibilidad AR. " +
                        "Usa Juku Go para descubrir animales."
                }
            }
        }
    }

    /**
     * Limpia el cache — útil en tests o al reinstalar ARCore.
     */
    fun clearCache() {
        cachedTier = null
    }

    // ─────────────────────────────────────────────────────────────
    //  PRIVATE
    // ─────────────────────────────────────────────────────────────

    private fun classify(context: Context): DeviceTier {
        val result = ArDeviceCompatibility.checkCompatibility(context)
        Timber.i("DeviceCapabilityManager: ARCore result=%s", result.name)

        return when (result) {
            ArDeviceCompatibility.CompatibilityResult.COMPATIBLE -> {
                Timber.i("DeviceCapabilityManager: Classified as HIGH_END")
                DeviceTier.HIGH_END
            }
            else -> {
                // DEVICE_NOT_VERIFIED, ARCORE_NOT_AVAILABLE, CHECK_FAILED
                Timber.i("DeviceCapabilityManager: Classified as LOW_END (reason: %s)", result.name)
                DeviceTier.LOW_END
            }
        }
    }
}
