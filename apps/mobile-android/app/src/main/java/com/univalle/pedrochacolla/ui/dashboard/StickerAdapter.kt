package com.univalle.pedrochacolla.ui.dashboard

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.StickerDefinition

/**
 * RecyclerView adapter for the sticker palette grid.
 * Displays sticker thumbnails from the catalog.
 */
class StickerAdapter(
    private val stickerManager: StickerManager,
    private val onStickerClick: (StickerDefinition) -> Unit
) : ListAdapter<StickerDefinition, StickerAdapter.ViewHolder>(DIFF) {

    private var selectedKey: String? = null

    fun setSelectedKey(key: String?) {
        val oldKey = selectedKey
        selectedKey = key
        // Only rebind changed items
        currentList.forEachIndexed { index, def ->
            if (def.key == oldKey || def.key == key) {
                notifyItemChanged(index)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_sticker, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val def = getItem(position)
        holder.bind(def, def.key == selectedKey)
    }

    inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val ivThumb: ImageView = itemView.findViewById(R.id.iv_sticker_thumb)
        private val tvName: TextView = itemView.findViewById(R.id.tv_sticker_name)
        private val selectionIndicator: View = itemView.findViewById(R.id.selection_indicator)

        fun bind(def: StickerDefinition, isSelected: Boolean) {
            tvName.text = def.name
            selectionIndicator.visibility = if (isSelected) View.VISIBLE else View.GONE

            // Load thumbnail from cache
            val bitmap = stickerManager.getThumbnailBitmap(def.key)
            if (bitmap != null) {
                ivThumb.setImageBitmap(bitmap)
            } else {
                ivThumb.setImageResource(android.R.drawable.ic_menu_gallery)
            }

            itemView.setOnClickListener {
                onStickerClick(def)
            }
        }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<StickerDefinition>() {
            override fun areItemsTheSame(a: StickerDefinition, b: StickerDefinition) = a.key == b.key
            override fun areContentsTheSame(a: StickerDefinition, b: StickerDefinition) = a == b
        }
    }
}
