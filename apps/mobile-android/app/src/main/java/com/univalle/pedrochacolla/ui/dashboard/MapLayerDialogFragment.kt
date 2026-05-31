package com.univalle.pedrochacolla.ui.dashboard

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.*
import com.univalle.pedrochacolla.data.repository.MapConfigurationRepository
import com.univalle.pedrochacolla.utils.session.UserSession
import com.univalle.pedrochacolla.utils.window.BannerUtil
import kotlinx.coroutines.launch

/**
 * Dialog for saving/loading map layer configurations.
 * Shows a list of available configurations with save, load, and delete options.
 */
class MapLayerDialogFragment : DialogFragment() {

    companion object {
        const val TAG = "MapLayerDialog"

        fun newInstance(): MapLayerDialogFragment = MapLayerDialogFragment()
    }

    /** Use the app's Material theme so ?attr/materialButtonOutlinedStyle resolves correctly */
    override fun getTheme(): Int = R.style.Theme_PedroChacolla

    private val repo = MapConfigurationRepository()

    /** Callback to capture current map state */
    var onSaveRequested: (() -> MapConfigData)? = null

    /** Callback to apply a loaded configuration */
    var onLoadRequested: ((MapConfigData) -> Unit)? = null

    private var configList = mutableListOf<MapConfiguration>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        val view = inflater.inflate(R.layout.dialog_map_layers, container, false)

        val listView = view.findViewById<ListView>(R.id.layer_list)
        val btnSave = view.findViewById<Button>(R.id.btn_save_layer)
        val btnClose = view.findViewById<Button>(R.id.btn_close_dialog)

        btnClose.setOnClickListener { dismiss() }

        btnSave.setOnClickListener {
            showSaveDialog()
        }

        val adapter = ArrayAdapter<String>(requireContext(), android.R.layout.simple_list_item_1)
        listView.adapter = adapter

        listView.setOnItemClickListener { _, _, position, _ ->
            if (position < configList.size) {
                val config = configList[position]
                onLoadRequested?.invoke(config.configData)
                BannerUtil.showBanner(requireActivity(), "Capa '${config.name}' cargada")
                dismiss()
            }
        }

        listView.setOnItemLongClickListener { _, _, position, _ ->
            if (position < configList.size) {
                val config = configList[position]
                showDeleteConfirmation(config)
            }
            true
        }

        // Load available configurations
        lifecycleScope.launch {
            val result = repo.getAvailable("mobile")
            result.onSuccess { configs ->
                configList.clear()
                configList.addAll(configs)
                adapter.clear()
                adapter.addAll(configs.map { c ->
                    val owner = if (c.isPublic) " (público)" else ""
                    "${c.name}$owner"
                })
                adapter.notifyDataSetChanged()
            }
            result.onFailure {
                Toast.makeText(requireContext(), "Error al cargar capas: ${it.message}", Toast.LENGTH_SHORT).show()
            }
        }

        return view
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    private fun showSaveDialog() {
        val input = EditText(requireContext()).apply {
            hint = "Nombre de la capa"
            setPadding(48, 32, 48, 16)
        }

        val checkBox = CheckBox(requireContext()).apply {
            text = "Hacer pública (compartir con otros usuarios)"
            setPadding(48, 0, 48, 16)
        }

        val layout = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            addView(input)
            addView(checkBox)
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Guardar capa del mapa")
            .setView(layout)
            .setPositiveButton("Guardar") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isEmpty()) {
                    Toast.makeText(requireContext(), "Ingresa un nombre", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val configData = onSaveRequested?.invoke() ?: return@setPositiveButton

                val config = MapConfiguration(
                    name = name,
                    platform = "mobile",
                    configData = configData,
                    isPublic = checkBox.isChecked
                )

                lifecycleScope.launch {
                    val result = repo.create(config)
                    result.onSuccess {
                        BannerUtil.showBanner(requireActivity(), "Capa '$name' guardada")
                        dismiss()
                    }
                    result.onFailure {
                        Toast.makeText(requireContext(), "Error: ${it.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showDeleteConfirmation(config: MapConfiguration) {
        val userId = UserSession.currentUser?.id
        if (config.userId != userId) {
            Toast.makeText(requireContext(), "Solo puedes eliminar tus propias capas", Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Eliminar capa")
            .setMessage("¿Eliminar '${config.name}'?")
            .setPositiveButton("Eliminar") { _, _ ->
                lifecycleScope.launch {
                    val id = config.id ?: return@launch
                    val result = repo.delete(id)
                    result.onSuccess {
                        configList.remove(config)
                        BannerUtil.showBanner(requireActivity(), "Capa eliminada")
                        // Refresh the list
                        dismiss()
                    }
                    result.onFailure {
                        Toast.makeText(requireContext(), "Error: ${it.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
