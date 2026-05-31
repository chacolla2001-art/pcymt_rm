package com.univalle.pedrochacolla.ui.dashboard

import android.graphics.Color
import android.graphics.PorterDuff
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.univalle.pedrochacolla.R

/**
 * Data class representing a carousel item (replaces Triple with LatLng)
 */
data class CarouselItem(
    val iconUrl: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val anchorId: String,
    val isFound: Boolean = false
)

/**
 * Adapter for the animal carousel in the map screen.
 * Matches the collection style: icon + label, gray/dim when not captured, full colour when found.
 * No click action — the carousel is display-only in this screen.
 */
class IconCarouselAdapter :
    ListAdapter<CarouselItem, IconCarouselAdapter.IconViewHolder>(IconDiffCallback()) {

    inner class IconViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivIcon: ImageView = view.findViewById(R.id.ivIcon)
        val tvLabel: TextView = view.findViewById(R.id.tvIconLabel)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): IconViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_icon_carousel, parent, false)
        return IconViewHolder(view)
    }

    override fun onBindViewHolder(holder: IconViewHolder, position: Int) {
        val item = getItem(position)

        Glide.with(holder.ivIcon.context)
            .load(item.iconUrl)
            .placeholder(R.drawable.ic_launcher_foreground)
            .into(holder.ivIcon)

        holder.tvLabel.text = item.name

        if (item.isFound) {
            holder.ivIcon.clearColorFilter()
            holder.ivIcon.alpha = 1f
            holder.tvLabel.alpha = 1f
        } else {
            holder.ivIcon.setColorFilter(Color.GRAY, PorterDuff.Mode.SRC_IN)
            holder.ivIcon.alpha = 0.3f
            holder.tvLabel.alpha = 0.3f
        }
    }

    private class IconDiffCallback : DiffUtil.ItemCallback<CarouselItem>() {
        override fun areItemsTheSame(
            oldItem: CarouselItem,
            newItem: CarouselItem
        ): Boolean = oldItem.anchorId == newItem.anchorId

        override fun areContentsTheSame(
            oldItem: CarouselItem,
            newItem: CarouselItem
        ): Boolean = oldItem == newItem
    }
}
