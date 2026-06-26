package com.univalle.pedrochacolla.ui.onboarding

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.univalle.pedrochacolla.MainActivity
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.databinding.ActivityOnboardingBinding
import com.univalle.pedrochacolla.utils.onboarding.OnboardingPreferences

class OnboardingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityOnboardingBinding
    private var currentStep = 0

    private data class OnboardingPage(
        val titleRes: Int,
        val descriptionRes: Int,
        val imageRes: Int? = null,
    )

    private val pages = listOf(
        OnboardingPage(
            titleRes = R.string.onboarding_welcome_title,
            descriptionRes = R.string.onboarding_welcome_desc,
        ),
        OnboardingPage(
            titleRes = R.string.onboarding_explore_title,
            descriptionRes = R.string.onboarding_explore_desc,
            imageRes = R.drawable.ic_explorer,
        ),
        OnboardingPage(
            titleRes = R.string.onboarding_collect_title,
            descriptionRes = R.string.onboarding_collect_desc,
            imageRes = R.drawable.ic_collection,
        ),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnOnboardingAction.setOnClickListener {
            if (currentStep < pages.lastIndex) {
                currentStep++
                renderStep()
            } else {
                finishOnboarding()
            }
        }

        renderStep()
    }

    private fun renderStep() {
        val page = pages[currentStep]
        binding.tvOnboardingTitle.setText(page.titleRes)
        binding.tvOnboardingDescription.setText(page.descriptionRes)
        binding.tvOnboardingStep.text = getString(
            R.string.onboarding_step_format,
            currentStep + 1,
            pages.size,
        )

        page.imageRes?.let { binding.ivOnboardingImage.setImageResource(it) }
            ?: binding.ivOnboardingImage.setImageResource(R.drawable.juku_gamer)

        binding.btnOnboardingAction.setText(
            if (currentStep == pages.lastIndex) {
                R.string.onboarding_start
            } else {
                R.string.onboarding_next
            },
        )
    }

    private fun finishOnboarding() {
        OnboardingPreferences(this).markCompleted()
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
