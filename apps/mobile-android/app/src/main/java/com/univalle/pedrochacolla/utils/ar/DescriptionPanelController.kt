package com.univalle.pedrochacolla.utils.ar

import android.view.View
import android.view.animation.DecelerateInterpolator

/**
 * DescriptionPanelController - Manages anchor description panel animations
 *
 * Responsibilities:
 * - Show/hide description panel with slide animations
 * - Control panel visibility and transitions
 *
 * Extracted from ArFragment lines 755-778
 */
class DescriptionPanelController(
    private val panel: View
) {

    /**
     * Show description panel with slide-down animation
     * @param finalY Final Y position from top (default 150f)
     */
    fun show(finalY: Float = 150f) {
        panel.visibility = View.VISIBLE
        panel.translationY = -panel.height.toFloat() - 200f
        panel.alpha = 0f
        panel.animate()
            .translationY(finalY)
            .alpha(1f)
            .setDuration(200)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    /**
     * Hide description panel with slide-up animation
     */
    fun hide() {
        panel.animate()
            .translationY(-panel.height.toFloat() - 200f)
            .alpha(0f)
            .setDuration(200)
            .withEndAction {
                panel.visibility = View.GONE
            }
            .start()
    }

    /**
     * Toggle panel visibility
     */
    fun toggle() {
        if (panel.visibility == View.VISIBLE) hide() else show()
    }

    /**
     * Check if panel is currently visible
     */
    fun isVisible(): Boolean {
        return panel.visibility == View.VISIBLE
    }
}
