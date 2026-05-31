package com.univalle.pedrochacolla.adapters

import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CircleCrop
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.ui.home.AnimalTrophy
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper

/**
 * Adapter for the horizontal "Animales Capturados" trophy strip on the home game screen.
 *
 * - FOUND animals: full colour icon with green border ring, ✓ badge, real name.
 * - LOCKED animals: greyscale + dimmed icon with grey border ring, "???" label.
 */
class AnimalTrophyAdapter :
    ListAdapter<AnimalTrophy, AnimalTrophyAdapter.TrophyViewHolder>(TrophyDiffCallback()) {

    inner class TrophyViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val frameBadge: FrameLayout = view.findViewById(R.id.frameTrophyIcon)
        val ivIcon: ImageView = view.findViewById(R.id.ivTrophyIcon)
        val tvCheckBadge: TextView = view.findViewById(R.id.tvFoundBadge)
        val tvName: TextView = view.findViewById(R.id.tvTrophyName)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TrophyViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_animal_trophy, parent, false)
        return TrophyViewHolder(view)
    }

    override fun onBindViewHolder(holder: TrophyViewHolder, position: Int) {
        val item = getItem(position)
        val context = holder.itemView.context

        if (item.isFound) {
            // ── FOUND ── full colour, green ring, checkmark, real name
            holder.frameBadge.background =
                ContextCompat.getDrawable(context, R.drawable.bg_trophy_found)
            holder.tvCheckBadge.visibility = View.VISIBLE
            holder.tvName.text = item.name
            holder.tvName.alpha = 1f

            Glide.with(context)
                .load(ImageUrlHelper.buildUrl(item.iconUrl))
                .transform(CircleCrop())
                .placeholder(R.drawable.ic_launcher_foreground)
                .error(R.drawable.ic_launcher_foreground)
                .into(holder.ivIcon)

            holder.ivIcon.colorFilter = null
            holder.ivIcon.alpha = 1f

        } else {
            // ── LOCKED ── greyscale + dim, grey ring, no badge, "???"
            holder.frameBadge.background =
                ContextCompat.getDrawable(context, R.drawable.bg_trophy_locked)
            holder.tvCheckBadge.visibility = View.GONE
            holder.tvName.text = "?"
            holder.tvName.alpha = 0.5f

            val url = ImageUrlHelper.buildUrl(item.iconUrl)
            if (url != null) {
                Glide.with(context)
                    .load(url)
                    .transform(CircleCrop())
                    .placeholder(R.drawable.ic_launcher_foreground)
                    .into(holder.ivIcon)
            } else {
                holder.ivIcon.setImageResource(R.drawable.ic_launcher_foreground)
            }

            // Apply greyscale colour filter
            val matrix = ColorMatrix().apply { setSaturation(0f) }
            holder.ivIcon.colorFilter = ColorMatrixColorFilter(matrix)
            holder.ivIcon.alpha = 0.4f
        }
    }

    private class TrophyDiffCallback : DiffUtil.ItemCallback<AnimalTrophy>() {
        override fun areItemsTheSame(oldItem: AnimalTrophy, newItem: AnimalTrophy): Boolean =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: AnimalTrophy, newItem: AnimalTrophy): Boolean =
            oldItem == newItem
    }
}
