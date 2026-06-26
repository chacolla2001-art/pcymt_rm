package com.univalle.pedrochacolla.utils.onboarding

import android.content.Context

class OnboardingPreferences(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun isCompleted(): Boolean = prefs.getBoolean(KEY_COMPLETED, false)

    fun markCompleted() {
        prefs.edit().putBoolean(KEY_COMPLETED, true).apply()
    }

    companion object {
        private const val PREFS_NAME = "juku_go_onboarding"
        private const val KEY_COMPLETED = "completed"
    }
}
