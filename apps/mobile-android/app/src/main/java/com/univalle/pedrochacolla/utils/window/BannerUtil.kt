package com.univalle.pedrochacolla.utils.window

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import com.univalle.pedrochacolla.R

object BannerUtil {

    private var autoCloseHandler: Handler? = null
    private var autoCloseRunnable: Runnable? = null

    fun showBanner(
        activity: Activity,
        message: String,
        durationMillis: Long = 3000
    ) {
        val banner = activity.findViewById<LinearLayout>(R.id.banner_overlay)
        val bannerMessage = banner.findViewById<TextView>(R.id.banner_message)
        val bannerClose = banner.findViewById<ImageButton>(R.id.banner_close)

        // Cancelar anteriores
        cancelAutoClose()

        bannerMessage.text = message

        val slideIn = AnimationUtils.loadAnimation(activity, R.anim.slide_in_top)
        banner.startAnimation(slideIn)
        banner.visibility = View.VISIBLE

        bannerClose.setOnClickListener {
            cancelAutoClose() // 👈 detener auto cierre si se hace manual
            val slideOut = AnimationUtils.loadAnimation(activity, R.anim.slide_out_top)
            banner.startAnimation(slideOut)
            banner.postDelayed({ banner.visibility = View.GONE }, 300)
        }

        // Programar cierre automático
        autoCloseHandler = Handler(Looper.getMainLooper())
        autoCloseRunnable = Runnable {
            val slideOut = AnimationUtils.loadAnimation(activity, R.anim.slide_out_top)
            banner.startAnimation(slideOut)
            banner.postDelayed({ banner.visibility = View.GONE }, 300)
        }
        autoCloseHandler?.postDelayed(autoCloseRunnable!!, durationMillis)
    }

    private fun cancelAutoClose() {
        autoCloseHandler?.removeCallbacks(autoCloseRunnable ?: return)
        autoCloseHandler = null
        autoCloseRunnable = null
    }
}
