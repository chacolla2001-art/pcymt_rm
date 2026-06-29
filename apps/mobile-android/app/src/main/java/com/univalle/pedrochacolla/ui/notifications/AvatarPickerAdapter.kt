package com.univalle.pedrochacolla.ui.notifications

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.PredefinedAvatar
import com.univalle.pedrochacolla.utils.image.ImageUrlHelper

class AvatarPickerAdapter(
    private var avatars: List<PredefinedAvatar> = emptyList(),
    private var selectedId: String? = null,
    private val onSelect: (PredefinedAvatar) -> Unit
) : RecyclerView.Adapter<AvatarPickerAdapter.AvatarViewHolder>() {

    fun submitList(list: List<PredefinedAvatar>, selected: String?) {
        avatars = list
        selectedId = selected
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AvatarViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_avatar_option, parent, false)
        return AvatarViewHolder(view)
    }

    override fun onBindViewHolder(holder: AvatarViewHolder, position: Int) {
        holder.bind(avatars[position])
    }

    override fun getItemCount(): Int = avatars.size

    inner class AvatarViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val image: ImageView = itemView.findViewById(R.id.imgAvatarOption)

        fun bind(avatar: PredefinedAvatar) {
            val url = ImageUrlHelper.buildUrl(avatar.url)
            Glide.with(itemView.context)
                .load(url)
                .placeholder(R.drawable.ic_launcher_foreground)
                .into(image)

            val selected = avatar.id == selectedId
            itemView.alpha = if (selected) 1f else 0.75f
            itemView.scaleX = if (selected) 1.08f else 1f
            itemView.scaleY = if (selected) 1.08f else 1f

            itemView.setOnClickListener { onSelect(avatar) }
        }
    }
}
