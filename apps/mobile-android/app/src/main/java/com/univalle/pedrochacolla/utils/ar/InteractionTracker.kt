package com.univalle.pedrochacolla.utils.ar

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.*

object InteractionTracker {
    private const val PREF_NAME = "UserInteractionPrefs"
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun hasInteractedToday(key: String): Boolean {
        val today = getToday()
        return prefs.getString(key, "") == today
    }

    fun setInteractionForToday(key: String) {
        prefs.edit().putString(key, getToday()).apply()
    }

    /**
     * Borra todos los registros locales de deduplicación.
     * Debe llamarse cuando el usuario reinicia el juego para que
     * todas las ubicaciones puedan volver a registrarse.
     */
    fun clearAll() {
        if (::prefs.isInitialized) {
            prefs.edit().clear().apply()
        }
    }

    private fun getToday(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return sdf.format(Date())
    }
}