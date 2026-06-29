package com.univalle.pedrochacolla.ui.ar

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
import com.univalle.pedrochacolla.data.model.VirtualAsset
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper

/**
 * AnimalPickerAdapter - Horizontal RecyclerView adapter for the AR animal picker.
 *
 * Displays each active VirtualAsset as an icon + name chip.
 * The selected item gets a highlighted background so the admin sees which animal
 * will be associated with the cloud anchor before uploading.
 */
class AnimalPickerAdapter(
    private val layoutRes: Int = R.layout.item_animal_picker,
    private val onSelected: (VirtualAsset) -> Unit
) : ListAdapter<VirtualAsset, AnimalPickerAdapter.ViewHolder>(DiffCallback()) {

    private var selectedId: String? = null

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivIcon: ImageView = view.findViewById(R.id.iv_animal_icon)
        val tvName: TextView  = view.findViewById(R.id.tv_animal_name)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(layoutRes, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val asset = getItem(position)

        // Load animal icon via authenticated Glide client
        Glide.with(holder.ivIcon.context)
            .load(ImageUrlHelper.buildUrl(asset.iconUrl))
            .placeholder(R.drawable.ic_launcher_foreground)
            .into(holder.ivIcon)

        holder.tvName.text = asset.name

        // Highlight selected item
        val isSelected = asset.id == selectedId
        val bgColor = if (isSelected) {
            android.graphics.Color.parseColor("#FF634F46")  // pcymt_primary
        } else {
            0x33FFFFFF.toInt()
        }
        holder.itemView.setBackgroundColor(bgColor)
        holder.itemView.alpha = if (isSelected) 1f else 0.75f

        holder.itemView.setOnClickListener {
            val prev = selectedId
            selectedId = asset.id
            // Refresh the previously selected and the newly selected items only
            if (prev != null) {
                val prevPos = currentList.indexOfFirst { it.id == prev }
                if (prevPos >= 0) notifyItemChanged(prevPos)
            }
            notifyItemChanged(position)
            onSelected(asset)
        }
    }

    /** Returns the currently selected VirtualAsset or null. */
    fun getSelectedAsset(): VirtualAsset? =
        currentList.firstOrNull { it.id == selectedId }

    /** Programmatically clear the selection (e.g. when resetting to idle). */
    fun clearSelection() {
        val prev = selectedId
        selectedId = null
        if (prev != null) {
            val prevPos = currentList.indexOfFirst { it.id == prev }
            if (prevPos >= 0) notifyItemChanged(prevPos)
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<VirtualAsset>() {
        override fun areItemsTheSame(old: VirtualAsset, new: VirtualAsset) =
            old.id == new.id
        override fun areContentsTheSame(old: VirtualAsset, new: VirtualAsset) =
            old.id == new.id && old.name == new.name && old.iconUrl == new.iconUrl
    }
}
