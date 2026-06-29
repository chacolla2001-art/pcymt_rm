package com.univalle.pedrochacolla.utils.map

import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

/** Plano del mapa para partículas ambientales (coords. canvas base). */
data class MapPlaneBounds(
    val minX: Float,
    val maxX: Float,
    val minY: Float,
    val maxY: Float,
)

data class AmbientWind(
    val deg: Float = 245f,
    val strength: Float = 0.45f,
)

data class AmbientTickOptions(
    val bounds: MapPlaneBounds,
    val containsPoint: ((Float, Float) -> Boolean)? = null,
    val wind: AmbientWind = AmbientWind(),
)

object MapAmbientZone {
    fun ambientScreenScale(screenScale: Float, sizeMul: Float): Float {
        val zoomComp = maxOf(0.25f, screenScale).toDouble().pow(0.52).toFloat()
        return zoomComp * sizeMul
    }

    fun ambientWindVector(wind: AmbientWind): Pair<Float, Float> {
        val rad = Math.toRadians(wind.deg.toDouble())
        val s = wind.strength.coerceIn(0f, 1f) * 0.35f
        return (cos(rad).toFloat() * s) to (sin(rad).toFloat() * s)
    }

    fun parkPlanSize(px: Float): Float = px

    fun parkParticleTarget(min: Int, max: Int, intensity: Float): Int {
        val t = intensity.coerceIn(0.15f, 1f)
        return (min + (max - min) * t).toInt()
    }
}
