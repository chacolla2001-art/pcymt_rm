package com.univalle.pedrochacolla.utils.ar

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.view.View
import android.view.animation.DecelerateInterpolator
import androidx.core.animation.doOnEnd

/**
 * FabMenuController - Manages Floating Action Button menu animations
 *
 * Responsibilities:
 * - Show/hide FAB menu with smooth animations
 * - Control individual FAB visibility and transitions
 *
 * Extracted from ArFragment lines 659-696
 */
class FabMenuController(
    private val fabButtons: List<View>
) {

    var isMenuOpen: Boolean = false
        private set

    /**
     * Show all FABs with slide-up animation
     * @param translationY Y-axis translation amount (default -1f for upward movement)
     */
    fun show(translationY: Float = -1f) {
        fabButtons.forEach { animateFabShow(it, translationY) }
        isMenuOpen = true
    }

    /**
     * Hide all FABs with slide-down animation
     */
    fun hide() {
        fabButtons.forEach { animateFabHide(it) }
        isMenuOpen = false
    }

    /**
     * Toggle menu visibility
     */
    fun toggle() {
        if (isMenuOpen) hide() else show()
    }

    /**
     * Animate FAB into view with slide and fade
     */
    private fun animateFabShow(fab: View, translationY: Float) {
        fab.visibility = View.VISIBLE
        AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(fab, View.TRANSLATION_Y, 0f, translationY),
                ObjectAnimator.ofFloat(fab, View.ALPHA, 0f, 1f)
            )
            duration = 300
            interpolator = DecelerateInterpolator()
            start()
        }
    }

    /**
     * Animate FAB out of view with slide and fade
     */
    private fun animateFabHide(fab: View) {
        AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(fab, View.TRANSLATION_Y, fab.translationY, 0f),
                ObjectAnimator.ofFloat(fab, View.ALPHA, 1f, 0f)
            )
            duration = 200
            interpolator = DecelerateInterpolator()
            start()
        }.doOnEnd { fab.visibility = View.GONE }
    }
}
