package com.univalle.pedrochacolla.utils.ar

import android.os.Handler
import android.os.Looper
import com.univalle.pedrochacolla.data.model.AnimationClip
import io.github.sceneview.node.ModelNode
import timber.log.Timber

/**
 * AnimationSequenceController - Manages sequential animation playback on 3D models
 *
 * Responsibilities:
 * - Play animation clips in sequence
 * - Handle animation timing and transitions
 * - Support looping sequences
 *
 * Extracted from ArFragment lines 780-829
 *
 * Usage:
 * ```kotlin
 * val controller = AnimationSequenceController()
 * controller.playSequence(modelNode, listOf(clip1, clip2, clip3))
 * controller.stop()
 * ```
 */
class AnimationSequenceController {

    private var handler: Handler? = null
    private var isPlaying: Boolean = false

    /**
     * Play a sequence of animation clips on the model
     *
     * @param modelNode The ModelNode to animate
     * @param sequence List of AnimationClips to play in order
     * @param loop Whether to loop the sequence indefinitely
     */
    fun playSequence(modelNode: ModelNode, sequence: List<AnimationClip>, loop: Boolean = true) {
        if (sequence.isEmpty()) return

        isPlaying = true
        handler = Handler(Looper.getMainLooper())

        fun playStep(index: Int) {
            if (!isPlaying) return

            val actualIndex = if (loop) index % sequence.size else index
            if (!loop && actualIndex >= sequence.size) {
                stop()
                return
            }

            val clipIndex = sequence[actualIndex].clip

            try {
                // Stop any currently playing animations
                modelNode.playingAnimations.keys.toList().forEach {
                    modelNode.stopAnimation(it)
                }

                // Get real clip duration
                val clipDurationMs = try {
                    (modelNode.animator.getAnimationDuration(clipIndex) * 1000).toLong()
                } catch (e: Exception) {
                    Timber.w("Couldn't get duration for clip $clipIndex")
                    1000L // Fallback to 1 second
                }

                // Play animation clip (no loop, sequence handles looping)
                modelNode.playAnimation(clipIndex, loop = false)

                // Schedule next animation after real duration
                handler?.postDelayed({
                    playStep(actualIndex + 1)
                }, clipDurationMs)

            } catch (e: Exception) {
                Timber.w("Invalid clip index=$clipIndex")
                // Skip to next clip on error
                handler?.post { playStep(actualIndex + 1) }
            }
        }

        // Start sequence from first clip
        playStep(0)
    }

    /**
     * Stop the current animation sequence
     */
    fun stop() {
        isPlaying = false
        handler?.removeCallbacksAndMessages(null)
        handler = null
    }

    /**
     * Check if sequence is currently playing
     */
    fun isPlaying(): Boolean {
        return isPlaying
    }

    /**
     * Cleanup resources
     * Call in Fragment/Activity onDestroy
     */
    fun cleanup() {
        stop()
    }
}
