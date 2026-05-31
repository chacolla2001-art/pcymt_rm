package com.univalle.pedrochacolla.ui.dashboard

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.univalle.pedrochacolla.R
import com.univalle.pedrochacolla.data.model.MapConfigData
import com.univalle.pedrochacolla.data.model.MapConfiguration
import com.univalle.pedrochacolla.data.repository.MapConfigurationRepository
import com.univalle.pedrochacolla.utils.session.UserSession
import com.univalle.pedrochacolla.utils.window.BannerUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Bottom-sheet panel for the single shared public map configuration.
 * Replaces the old MapLayerDialogFragment dialog.
 *
 * - Everyone can LOAD the public map
 * - Admin can SAVE (overwrites the single public config)
 * - No public/private checkbox — always public
 * - No list — just one shared map config
 */
class MapLayerPanelFragment : BottomSheetDialogFragment() {

    companion object {
        const val TAG = "MapLayerPanel"
        private const val PUBLIC_CONFIG_NAME = "Mapa Público"

        fun newInstance(): MapLayerPanelFragment = MapLayerPanelFragment()
    }

    private val repo = MapConfigurationRepository()

    /** Called to capture current map + sticker + POI state for saving */
    var onSaveRequested: (() -> MapConfigData)? = null

    /** Called to apply a loaded configuration */
    var onLoadRequested: ((MapConfigData) -> Unit)? = null

    /** Called when admin resets POI positions */
    var onResetPoiPositions: (() -> Unit)? = null

    private var publicConfig: MapConfiguration? = null

    // View refs
    private var tvConfigName: TextView? = null
    private var tvConfigUpdated: TextView? = null
    private var btnLoad: Button? = null
    private var btnSave: Button? = null
    private var btnResetPoi: Button? = null
    private var progressBar: ProgressBar? = null

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.behavior.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            peekHeight = 500
            isHideable = true
        }
        return dialog
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_map_layer_panel, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tvConfigName    = view.findViewById(R.id.tv_config_name)
        tvConfigUpdated = view.findViewById(R.id.tv_config_updated)
        btnLoad         = view.findViewById(R.id.btn_load_config)
        btnSave         = view.findViewById(R.id.btn_save_config)
        btnResetPoi     = view.findViewById(R.id.btn_reset_poi)
        progressBar     = view.findViewById(R.id.panel_progress)

        val isAdmin = UserSession.currentUser?.role == "admin"
        if (isAdmin) {
            btnSave?.visibility = View.VISIBLE
            btnResetPoi?.visibility = View.VISIBLE
        }

        btnLoad?.setOnClickListener { loadPublicConfig() }
        btnSave?.setOnClickListener { savePublicConfig() }
        btnResetPoi?.setOnClickListener {
            onResetPoiPositions?.invoke()
            BannerUtil.showBanner(requireActivity(), "Posiciones de POIs restablecidas")
        }

        fetchPublicConfig()
    }

    // ─── Fetch the single public config from backend ─────────────────────

    private fun fetchPublicConfig() {
        showProgress(true)
        tvConfigName?.text = "Cargando..."
        btnLoad?.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            val result = repo.getPublic("mobile")
            withContext(Dispatchers.Main) {
                showProgress(false)
                result.onSuccess { configs ->
                    val config = configs.firstOrNull()
                    publicConfig = config
                    if (config != null) {
                        tvConfigName?.text = config.name
                        val fmt = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                        val dateStr = config.updatedAt?.let { fmt.format(it) }
                            ?: config.createdAt?.let { fmt.format(it) }
                            ?: "—"
                        tvConfigUpdated?.text = "Actualizado: $dateStr"
                        btnLoad?.isEnabled = true
                    } else {
                        tvConfigName?.text = "Sin configuración pública"
                        tvConfigUpdated?.text = "El administrador aún no ha guardado un mapa"
                        btnLoad?.isEnabled = false
                    }
                }
                result.onFailure {
                    tvConfigName?.text = "Error al conectar"
                    tvConfigUpdated?.text = it.message ?: ""
                }
            }
        }
    }

    // ─── Load ─────────────────────────────────────────────────────────────

    private fun loadPublicConfig() {
        val config = publicConfig ?: return
        onLoadRequested?.invoke(config.configData)
        BannerUtil.showBanner(requireActivity(), "Mapa público cargado")
        dismiss()
    }

    // ─── Save (admin) ──────────────────────────────────────────────────────

    private fun savePublicConfig() {
        val configData = onSaveRequested?.invoke() ?: return
        showProgress(true)
        btnSave?.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            val existing = publicConfig

            val result = if (existing?.id != null) {
                // Update the existing public config
                repo.update(
                    existing.id,
                    MapConfiguration(
                        id = existing.id,
                        name = PUBLIC_CONFIG_NAME,
                        platform = "mobile",
                        configData = configData,
                        isPublic = true
                    )
                )
            } else {
                // Create new public config
                repo.create(
                    MapConfiguration(
                        name = PUBLIC_CONFIG_NAME,
                        platform = "mobile",
                        configData = configData,
                        isPublic = true
                    )
                )
            }

            withContext(Dispatchers.Main) {
                showProgress(false)
                btnSave?.isEnabled = true
                result.onSuccess { saved ->
                    publicConfig = saved
                    tvConfigName?.text = saved.name
                    val fmt = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                    tvConfigUpdated?.text = "Actualizado: ${saved.updatedAt?.let { fmt.format(it) } ?: "ahora"}"
                    BannerUtil.showBanner(requireActivity(), "Mapa público guardado")
                }
                result.onFailure {
                    Toast.makeText(requireContext(), "Error: ${it.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showProgress(show: Boolean) {
        progressBar?.visibility = if (show) View.VISIBLE else View.GONE
    }

    override fun onDestroyView() {
        tvConfigName = null
        tvConfigUpdated = null
        btnLoad = null
        btnSave = null
        btnResetPoi = null
        progressBar = null
        super.onDestroyView()
    }
}
