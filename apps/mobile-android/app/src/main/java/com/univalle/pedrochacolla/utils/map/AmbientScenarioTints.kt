package com.univalle.pedrochacolla.utils.map

import android.graphics.Color

data class AmbientScenarioTint(
    val topColor: Int,
    val bottomColor: Int,
    val alpha: Float,
)

/** Tintes de escenarios predefinidos (alineado con `ambient-scenarios.ts`). */
object AmbientScenarioTints {
    private val tints = mapOf(
        "storm-bajas" to AmbientScenarioTint(Color.rgb(30, 45, 70), Color.rgb(15, 25, 45), 0.38f),
        "mist-altas" to AmbientScenarioTint(Color.rgb(200, 220, 240), Color.rgb(170, 195, 220), 0.32f),
        "sunset-medias" to AmbientScenarioTint(Color.rgb(255, 210, 140), Color.rgb(255, 170, 90), 0.28f),
        "myth-night" to AmbientScenarioTint(Color.rgb(40, 60, 130), Color.rgb(20, 30, 80), 0.42f),
        "rain-zoom" to AmbientScenarioTint(Color.rgb(50, 70, 95), Color.rgb(35, 50, 75), 0.22f),
        "jungle-bajas" to AmbientScenarioTint(Color.rgb(60, 120, 70), Color.rgb(40, 90, 55), 0.3f),
    )

    fun tintForScenario(id: String?): AmbientScenarioTint? =
        id?.let { tints[it] }
}
