package com.univalle.pedrochacolla.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.AnchorIcon
import com.univalle.pedrochacolla.data.model.Section

class SectionAdapter(
    private var interactedIds: Set<String>,
    private val onIconClick: (AnchorIcon) -> Unit
) : ListAdapter<Section, SectionAdapter.SectionViewHolder>(SectionDiffCallback()) {

    /** Update the set of interacted location IDs and rebind visible items */
    fun updateInteractedIds(ids: Set<String>) {
        if (ids != interactedIds) {
            interactedIds = ids
            notifyDataSetChanged()
        }
    }

    // Shared RecycledViewPool for better performance
    private val sharedPool = RecyclerView.RecycledViewPool().apply {
        setMaxRecycledViews(0, 10) // Icon view type
    }

    inner class SectionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvSectionTitle: TextView = itemView.findViewById(R.id.tvSectionTitle)
        val rvIcons: RecyclerView = itemView.findViewById(R.id.rvIcons)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SectionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_section, parent, false)
        return SectionViewHolder(view)
    }

    override fun getItemCount(): Int = currentList.size

    override fun onBindViewHolder(holder: SectionViewHolder, position: Int) {
        val section = getItem(position)
        holder.tvSectionTitle.text = section.title

        holder.rvIcons.apply {
            layoutManager = GridLayoutManager(context, 3)
            setRecycledViewPool(sharedPool) // Share pool for better performance

            val iconAdapter = IconAdapter(interactedIds, onIconClick)
            adapter = iconAdapter
            iconAdapter.submitList(section.anchors)
        }
    }

    private class SectionDiffCallback : DiffUtil.ItemCallback<Section>() {
        override fun areItemsTheSame(oldItem: Section, newItem: Section): Boolean =
            oldItem.title == newItem.title

        override fun areContentsTheSame(oldItem: Section, newItem: Section): Boolean =
            oldItem == newItem
    }
}
