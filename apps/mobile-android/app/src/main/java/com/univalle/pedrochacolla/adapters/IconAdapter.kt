package com.univalle.pedrochacolla.adapters

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
import com.univalle.pedrochacolla.data.model.AnchorIcon
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper

class IconAdapter(
    private val interactedIds: Set<String>,
    private val onClick: (AnchorIcon) -> Unit
) : ListAdapter<AnchorIcon, IconAdapter.IconViewHolder>(IconDiffCallback()) {

    inner class IconViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivIcon: ImageView = view.findViewById(R.id.ivIcon)
        val tvLabel: TextView = view.findViewById(R.id.tvIconLabel)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): IconViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_icon, parent, false)
        return IconViewHolder(view)
    }

    override fun onBindViewHolder(holder: IconViewHolder, position: Int) {
        val item = getItem(position)

        Glide.with(holder.ivIcon.context)
            .load(ImageUrlHelper.buildUrl(item.iconUrl))
            .placeholder(R.drawable.ic_launcher_foreground)
            .into(holder.ivIcon)

        holder.tvLabel.text = item.description

        if (!interactedIds.contains(item.anchorId)) {
            holder.ivIcon.setColorFilter(Color.GRAY, PorterDuff.Mode.SRC_IN)
            holder.ivIcon.alpha = 0.3f
            holder.tvLabel.alpha = 0.3f
        } else {
            holder.ivIcon.clearColorFilter()
            holder.ivIcon.alpha = 1f
            holder.tvLabel.alpha = 1f
        }

        holder.itemView.setOnClickListener { onClick(item) }
    }

    private class IconDiffCallback : DiffUtil.ItemCallback<AnchorIcon>() {
        override fun areItemsTheSame(oldItem: AnchorIcon, newItem: AnchorIcon): Boolean =
            oldItem.anchorId == newItem.anchorId

        override fun areContentsTheSame(oldItem: AnchorIcon, newItem: AnchorIcon): Boolean =
            oldItem == newItem
    }
}
