package com.univalle.pedrochacolla.utils.navigation

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.univalle.pedrochacolla.MainActivity
import com.univalle.pedrochacolla.ui.onboarding.OnboardingActivity
import com.univalle.pedrochacolla.utils.onboarding.OnboardingPreferences

object AppEntryNavigation {
    fun openAfterAuth(context: Context) {
        val target = if (OnboardingPreferences(context).isCompleted()) {
            Intent(context, MainActivity::class.java)
        } else {
            Intent(context, OnboardingActivity::class.java)
        }

        context.startActivity(target)
        if (context is Activity) {
            context.finish()
        }
    }
}
