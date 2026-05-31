import { Component, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter, OnDestroy, HostListener, OnInit, Inject, PLATFORM_ID, Input } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AnchorPointService } from '../../anchor-points/services/anchor-point.service';
import { AnchorPoint, AnchorCluster } from '../../anchor-points/models/anchor-point.model';
import { ThemeManagerService } from '../../../core/services/theme-manager.service';
import { Subject, takeUntil } from 'rxjs';
import { StickerLayerService } from '../services/sticker-layer.service';
import { StickerInstance, StickerLayer } from '../models/sticker.model';
import { TilemapLayer, TilemapLayerData } from '../models/map-tile.model';

/**
 * MAPA DE ULTRA ALTA PRECISIÓN v3.0 - Parque de las Culturas y de la Madre Tierra
 *
 * Características:
 * 1. Sistema WGS84 (EPSG:4326) con 8 decimales (~1.1mm precisión)
 * 2. Labels que NO rotan (siempre legibles)
 * 3. Marcadores con tamaño constante independiente del zoom
 * 4. Rotación suave animada con soporte de mantener pulsado
 * 5. Panel de opciones colapsable
 * 6. Áreas/secciones del parque visibles
 * 7. Soporte de tema claro/oscuro
 * 8. Estado persistente en localStorage
 * 9. Polígono detallado con 100+ puntos
 */

interface GeoPoint {
  lat: number;
  lng: number;
}

interface CanvasPoint {
  x: number;
  y: number;
}

interface Marker {
  id: string;
  name: string;
  geo: GeoPoint;
  isInsidePark: boolean;
  section?: string;
}

interface ParkSection {
  name: string;
  color: string;
  colorLight: string;
  polygon: GeoPoint[];
}

// Polígono del parque con alta precisión (100+ puntos para curvas suaves)
const PARK_BOUNDARY: GeoPoint[] = [
  // Entrada norte
  { lat: -16.48659768, lng: -68.14596329 },
  { lat: -16.48665000, lng: -68.14593000 },
  { lat: -16.48680000, lng: -68.14585000 },
  { lat: -16.48700000, lng: -68.14575000 },
  { lat: -16.48720000, lng: -68.14567000 },
  { lat: -16.48740000, lng: -68.14560000 },
  { lat: -16.48760000, lng: -68.14554000 },
  { lat: -16.48780000, lng: -68.14549000 },
  { lat: -16.48800000, lng: -68.14545000 },
  { lat: -16.48822963, lng: -68.14541751 },
  { lat: -16.48832000, lng: -68.14535000 },
  { lat: -16.48841898, lng: -68.14528839 },
  { lat: -16.48855000, lng: -68.14523000 },
  { lat: -16.48870000, lng: -68.14518000 },
  { lat: -16.48886235, lng: -68.14515052 },
  { lat: -16.48888001, lng: -68.14519958 },
  { lat: -16.48900000, lng: -68.14510000 },
  { lat: -16.48920000, lng: -68.14502000 },
  { lat: -16.48940000, lng: -68.14495000 },
  { lat: -16.48960000, lng: -68.14488000 },
  { lat: -16.48980000, lng: -68.14481000 },
  { lat: -16.49000000, lng: -68.14475000 },
  { lat: -16.49020000, lng: -68.14469000 },
  { lat: -16.49040000, lng: -68.14465000 },
  { lat: -16.49055000, lng: -68.14463000 },
  { lat: -16.49068582, lng: -68.14462362 },
  { lat: -16.49070782, lng: -68.14472540 },
  { lat: -16.49074000, lng: -68.14480000 },
  { lat: -16.49078941, lng: -68.14487740 },
  { lat: -16.49082000, lng: -68.14491000 },
  { lat: -16.49086051, lng: -68.14496028 },
  { lat: -16.49092000, lng: -68.14500000 },
  { lat: -16.49099475, lng: -68.14505184 },
  { lat: -16.49105000, lng: -68.14508000 },
  { lat: -16.49110403, lng: -68.14510370 },
  { lat: -16.49115000, lng: -68.14511500 },
  { lat: -16.49120474, lng: -68.14512204 },
  { lat: -16.49127000, lng: -68.14513000 },
  { lat: -16.49133294, lng: -68.14513233 },
  { lat: -16.49138000, lng: -68.14513000 },
  { lat: -16.49142827, lng: -68.14512204 },
  { lat: -16.49149000, lng: -68.14510500 },
  { lat: -16.49156435, lng: -68.14508133 },
  { lat: -16.49161000, lng: -68.14506000 },
  { lat: -16.49166074, lng: -68.14502906 },
  { lat: -16.49171000, lng: -68.14498000 },
  { lat: -16.49176942, lng: -68.14491858 },
  // Curva sureste
  { lat: -16.49185000, lng: -68.14500000 },
  { lat: -16.49195000, lng: -68.14510000 },
  { lat: -16.49207074, lng: -68.14524457 },
  { lat: -16.49202000, lng: -68.14524500 },
  { lat: -16.49197133, lng: -68.14524635 },
  { lat: -16.49185000, lng: -68.14528000 },
  { lat: -16.49170000, lng: -68.14532000 },
  { lat: -16.49155000, lng: -68.14535000 },
  { lat: -16.49139718, lng: -68.14538138 },
  { lat: -16.49125000, lng: -68.14540000 },
  { lat: -16.49110000, lng: -68.14541500 },
  { lat: -16.49095112, lng: -68.14542437 },
  { lat: -16.49080000, lng: -68.14544000 },
  { lat: -16.49065000, lng: -68.14546000 },
  { lat: -16.49050000, lng: -68.14548000 },
  { lat: -16.49033610, lng: -68.14550804 },
  { lat: -16.49027000, lng: -68.14557000 },
  { lat: -16.49022058, lng: -68.14564895 },
  { lat: -16.49000000, lng: -68.14562000 },
  { lat: -16.48975000, lng: -68.14559000 },
  { lat: -16.48950180, lng: -68.14556667 },
  { lat: -16.48938000, lng: -68.14557500 },
  { lat: -16.48926133, lng: -68.14558171 },
  { lat: -16.48918000, lng: -68.14557800 },
  { lat: -16.48910599, lng: -68.14557360 },
  { lat: -16.48912299, lng: -68.14561761 },
  { lat: -16.48904000, lng: -68.14560500 },
  { lat: -16.48896332, lng: -68.14559755 },
  { lat: -16.48886000, lng: -68.14560500 },
  { lat: -16.48876984, lng: -68.14561738 },
  { lat: -16.48865000, lng: -68.14565000 },
  { lat: -16.48855000, lng: -68.14569000 },
  { lat: -16.48844095, lng: -68.14573936 },
  // Lado oeste - más curvo
  { lat: -16.48849000, lng: -68.14590000 },
  { lat: -16.48854573, lng: -68.14608713 },
  { lat: -16.48860000, lng: -68.14607000 },
  { lat: -16.48866891, lng: -68.14604836 },
  { lat: -16.48869000, lng: -68.14620000 },
  { lat: -16.48871507, lng: -68.14636503 },
  { lat: -16.48860000, lng: -68.14645000 },
  { lat: -16.48845000, lng: -68.14658000 },
  { lat: -16.48830000, lng: -68.14668000 },
  { lat: -16.48820410, lng: -68.14673619 },
  { lat: -16.48812000, lng: -68.14677000 },
  { lat: -16.48803366, lng: -68.14679585 },
  { lat: -16.48790000, lng: -68.14683000 },
  { lat: -16.48776299, lng: -68.14685615 },
  { lat: -16.48762000, lng: -68.14684000 },
  { lat: -16.48748103, lng: -68.14680104 },
  { lat: -16.48746000, lng: -68.14674000 },
  { lat: -16.48744563, lng: -68.14667352 },
  { lat: -16.48742500, lng: -68.14664000 },
  { lat: -16.48740845, lng: -68.14661360 },
  { lat: -16.48737000, lng: -68.14657000 },
  { lat: -16.48734035, lng: -68.14654090 },
  // Regreso al norte
  { lat: -16.48728000, lng: -68.14635000 },
  { lat: -16.48722000, lng: -68.14615000 },
  { lat: -16.48714337, lng: -68.14591061 },
  { lat: -16.48700000, lng: -68.14595000 },
  { lat: -16.48685000, lng: -68.14600000 },
  { lat: -16.48671717, lng: -68.14603711 },
  { lat: -16.48668000, lng: -68.14602500 },
  { lat: -16.48664566, lng: -68.14600784 },
  { lat: -16.48662000, lng: -68.14598500 },
  { lat: -16.48659707, lng: -68.14596340 },
  { lat: -16.48659768, lng: -68.14596329 }
];

// Secciones del parque - tessellating polygons covering the full park area
// Junction points on boundary: B15, B25, B62, B72, B104
// Divider TA-ML: B15 → internal → B104
// Divider TM-ML: B15 → B72
// Divider TM-TB: B25 → B62
const PARK_SECTIONS: ParkSection[] = [
  {
    name: 'Tierras Altas',
    color: 'rgba(139, 90, 43, 0.12)',
    colorLight: 'rgba(139, 90, 43, 0.08)',
    polygon: [
      // N boundary: entrance (B0) → NE (B15)
      { lat: -16.48659768, lng: -68.14596329 },
      { lat: -16.48665000, lng: -68.14593000 },
      { lat: -16.48680000, lng: -68.14585000 },
      { lat: -16.48700000, lng: -68.14575000 },
      { lat: -16.48720000, lng: -68.14567000 },
      { lat: -16.48740000, lng: -68.14560000 },
      { lat: -16.48760000, lng: -68.14554000 },
      { lat: -16.48780000, lng: -68.14549000 },
      { lat: -16.48800000, lng: -68.14545000 },
      { lat: -16.48822963, lng: -68.14541751 },
      { lat: -16.48832000, lng: -68.14535000 },
      { lat: -16.48841898, lng: -68.14528839 },
      { lat: -16.48855000, lng: -68.14523000 },
      { lat: -16.48870000, lng: -68.14518000 },
      { lat: -16.48886235, lng: -68.14515052 },
      { lat: -16.48888001, lng: -68.14519958 },
      // Divider TA-ML: B15 → internal → B104
      { lat: -16.48870000, lng: -68.14560000 },
      { lat: -16.48820000, lng: -68.14570000 },
      { lat: -16.48760000, lng: -68.14580000 },
      { lat: -16.48714337, lng: -68.14591061 },
      // NW boundary: B104 → entrance (B0)
      { lat: -16.48700000, lng: -68.14595000 },
      { lat: -16.48685000, lng: -68.14600000 },
      { lat: -16.48671717, lng: -68.14603711 },
      { lat: -16.48668000, lng: -68.14602500 },
      { lat: -16.48664566, lng: -68.14600784 },
      { lat: -16.48662000, lng: -68.14598500 },
      { lat: -16.48659707, lng: -68.14596340 }
    ]
  },
  {
    name: 'Tierras Medias',
    color: 'rgba(76, 175, 80, 0.12)',
    colorLight: 'rgba(76, 175, 80, 0.08)',
    polygon: [
      // NE boundary: B15 → B25
      { lat: -16.48888001, lng: -68.14519958 },
      { lat: -16.48900000, lng: -68.14510000 },
      { lat: -16.48920000, lng: -68.14502000 },
      { lat: -16.48940000, lng: -68.14495000 },
      { lat: -16.48960000, lng: -68.14488000 },
      { lat: -16.48980000, lng: -68.14481000 },
      { lat: -16.49000000, lng: -68.14475000 },
      { lat: -16.49020000, lng: -68.14469000 },
      { lat: -16.49040000, lng: -68.14465000 },
      { lat: -16.49055000, lng: -68.14463000 },
      { lat: -16.49068582, lng: -68.14462362 },
      // Divider TM-TB: B25 → B62
      { lat: -16.49033610, lng: -68.14550804 },
      // S boundary: B62 → B72
      { lat: -16.49027000, lng: -68.14557000 },
      { lat: -16.49022058, lng: -68.14564895 },
      { lat: -16.49000000, lng: -68.14562000 },
      { lat: -16.48975000, lng: -68.14559000 },
      { lat: -16.48950180, lng: -68.14556667 },
      { lat: -16.48938000, lng: -68.14557500 },
      { lat: -16.48926133, lng: -68.14558171 },
      { lat: -16.48918000, lng: -68.14557800 },
      { lat: -16.48910599, lng: -68.14557360 },
      { lat: -16.48912299, lng: -68.14561761 },
      // Divider TM-ML: B72 → B15
      { lat: -16.48888001, lng: -68.14519958 }
    ]
  },
  {
    name: 'Tierras Bajas',
    color: 'rgba(255, 193, 7, 0.12)',
    colorLight: 'rgba(255, 193, 7, 0.08)',
    polygon: [
      // SE peninsula: B25 → around tip → B62
      { lat: -16.49068582, lng: -68.14462362 },
      { lat: -16.49070782, lng: -68.14472540 },
      { lat: -16.49074000, lng: -68.14480000 },
      { lat: -16.49078941, lng: -68.14487740 },
      { lat: -16.49082000, lng: -68.14491000 },
      { lat: -16.49086051, lng: -68.14496028 },
      { lat: -16.49092000, lng: -68.14500000 },
      { lat: -16.49099475, lng: -68.14505184 },
      { lat: -16.49105000, lng: -68.14508000 },
      { lat: -16.49110403, lng: -68.14510370 },
      { lat: -16.49115000, lng: -68.14511500 },
      { lat: -16.49120474, lng: -68.14512204 },
      { lat: -16.49127000, lng: -68.14513000 },
      { lat: -16.49133294, lng: -68.14513233 },
      { lat: -16.49138000, lng: -68.14513000 },
      { lat: -16.49142827, lng: -68.14512204 },
      { lat: -16.49149000, lng: -68.14510500 },
      { lat: -16.49156435, lng: -68.14508133 },
      { lat: -16.49161000, lng: -68.14506000 },
      { lat: -16.49166074, lng: -68.14502906 },
      { lat: -16.49171000, lng: -68.14498000 },
      { lat: -16.49176942, lng: -68.14491858 },
      { lat: -16.49185000, lng: -68.14500000 },
      { lat: -16.49195000, lng: -68.14510000 },
      { lat: -16.49207074, lng: -68.14524457 },
      { lat: -16.49202000, lng: -68.14524500 },
      { lat: -16.49197133, lng: -68.14524635 },
      { lat: -16.49185000, lng: -68.14528000 },
      { lat: -16.49170000, lng: -68.14532000 },
      { lat: -16.49155000, lng: -68.14535000 },
      { lat: -16.49139718, lng: -68.14538138 },
      { lat: -16.49125000, lng: -68.14540000 },
      { lat: -16.49110000, lng: -68.14541500 },
      { lat: -16.49095112, lng: -68.14542437 },
      { lat: -16.49080000, lng: -68.14544000 },
      { lat: -16.49065000, lng: -68.14546000 },
      { lat: -16.49050000, lng: -68.14548000 },
      { lat: -16.49033610, lng: -68.14550804 },
      // Divider TM-TB: B62 → B25
      { lat: -16.49068582, lng: -68.14462362 }
    ]
  },
  {
    name: 'Mitos y Leyendas',
    color: 'rgba(103, 58, 183, 0.12)',
    colorLight: 'rgba(103, 58, 183, 0.08)',
    polygon: [
      // Divider TM-ML: B72 → B15
      { lat: -16.48912299, lng: -68.14561761 },
      { lat: -16.48888001, lng: -68.14519958 },
      // Divider TA-ML reversed: B15 → internal → B104
      { lat: -16.48870000, lng: -68.14560000 },
      { lat: -16.48820000, lng: -68.14570000 },
      { lat: -16.48760000, lng: -68.14580000 },
      { lat: -16.48714337, lng: -68.14591061 },
      // W boundary: B104 → SW arm → B72
      { lat: -16.48722000, lng: -68.14615000 },
      { lat: -16.48728000, lng: -68.14635000 },
      { lat: -16.48734035, lng: -68.14654090 },
      { lat: -16.48737000, lng: -68.14657000 },
      { lat: -16.48740845, lng: -68.14661360 },
      { lat: -16.48742500, lng: -68.14664000 },
      { lat: -16.48744563, lng: -68.14667352 },
      { lat: -16.48746000, lng: -68.14674000 },
      { lat: -16.48748103, lng: -68.14680104 },
      { lat: -16.48762000, lng: -68.14684000 },
      { lat: -16.48776299, lng: -68.14685615 },
      { lat: -16.48790000, lng: -68.14683000 },
      { lat: -16.48803366, lng: -68.14679585 },
      { lat: -16.48812000, lng: -68.14677000 },
      { lat: -16.48820410, lng: -68.14673619 },
      { lat: -16.48830000, lng: -68.14668000 },
      { lat: -16.48845000, lng: -68.14658000 },
      { lat: -16.48860000, lng: -68.14645000 },
      { lat: -16.48871507, lng: -68.14636503 },
      { lat: -16.48869000, lng: -68.14620000 },
      { lat: -16.48866891, lng: -68.14604836 },
      { lat: -16.48860000, lng: -68.14607000 },
      { lat: -16.48854573, lng: -68.14608713 },
      { lat: -16.48849000, lng: -68.14590000 },
      { lat: -16.48844095, lng: -68.14573936 },
      { lat: -16.48855000, lng: -68.14569000 },
      { lat: -16.48865000, lng: -68.14565000 },
      { lat: -16.48876984, lng: -68.14561738 },
      { lat: -16.48886000, lng: -68.14560500 },
      { lat: -16.48896332, lng: -68.14559755 },
      { lat: -16.48904000, lng: -68.14560500 },
      { lat: -16.48912299, lng: -68.14561761 }
    ]
  }
];

// Constantes geodésicas
const LAT_CENTER = -16.48933421;
const LNG_CENTER = -68.14573989;
const METERS_PER_DEG_LAT = 111320;
const LAT_CORRECTION = Math.cos(LAT_CENTER * Math.PI / 180);
const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * LAT_CORRECTION;

// Colores para tema oscuro y claro — matches ParkMapView ThemeColors from mobile app
const THEME_COLORS = {
  dark: {
    background: '#1a1a2e',
    grid: 'rgba(50, 50, 80, 0.5)',
    gridText: 'rgba(100, 100, 150, 0.7)',
    boundary: '#4caf50',
    boundaryFill: 'rgba(76, 175, 80, 0.2)',
    text: '#ffffff',
    textSecondary: '#888888',
    panelBg: 'rgba(0, 0, 0, 0.78)',
    panelBorder: '#444444',
    accent: '#4caf50',
    markerInside: '#4caf50',
    markerOutside: '#f44336',
    scale: '#4caf50'
  },
  light: {
    background: '#f5f5f5',
    grid: 'rgba(100, 100, 120, 0.3)',
    gridText: 'rgba(80, 80, 100, 0.8)',
    boundary: '#2e7d32',
    boundaryFill: 'rgba(76, 175, 80, 0.15)',
    text: '#212121',
    textSecondary: '#666666',
    panelBg: 'rgba(255, 255, 255, 0.90)',
    panelBorder: '#cccccc',
    accent: '#2e7d32',
    markerInside: '#2e7d32',
    markerOutside: '#c62828',
    scale: '#2e7d32'
  }
};

function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    if (((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

@Component({
  selector: 'app-map-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="precision-map" [class.light-theme]="!isDarkTheme">
      <canvas #mapCanvas
        [class.coord-picker]="coordPickerMode"
        (mousedown)="onMouseDown($event)"
        (mousemove)="onMouseMove($event)"
        (mouseup)="onMouseUp()"
        (mouseleave)="onMouseLeave()"
        (wheel)="onWheel($event)"
        (click)="onClick($event)"
        (dragover)="onDragOver($event)"
        (drop)="onMapDrop($event)"
        (contextmenu)="$event.preventDefault()">
      </canvas>



      <div class="copy-toast" [class.visible]="showCopyToast">
        📋 {{ lastCopiedCoords }}
      </div>

      <!-- Hint -->
      <div class="click-hint">
        {{ editorMode
           ? editorActiveTool === 'sticker' ? 'Click para colocar sticker | Esc = cancelar'
             : editorActiveTool === 'eraser' ? 'Click sobre un item para borrarlo'
             : editorActiveTool === 'coordinate' ? 'Click para copiar coordenadas'
             : 'Click para seleccionar | Arrastra mover | Del = eliminar | Scroll = zoom'
           : coordPickerMode
             ? 'Click en el mapa para copiar coordenadas GPS | Usa vista Z↓ para máxima precisión'
             : stickerEditMode
               ? 'Del = eliminar | Ctrl+Z/Y = deshacer/rehacer | Arrastra para mover | ↑↓←→ = nudge'
               : 'Scroll = zoom | Arrastrar = mover mapa | Ctrl+Z = deshacer' }}
      </div>

      <!-- Sticker edit mode banner -->
      <div class="edit-banner" *ngIf="stickerEditMode && !editorMode">
        ✏️ Modo edición de stickers
      </div>

      <!-- Editor mode banner -->
      <div class="edit-banner editor-banner" *ngIf="editorMode">
        🗺️ Editor de tiles
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; }

    .precision-map {
      --bg: #1a1a2e;
      --text: #ffffff;
      --text-secondary: #888888;
      --panel-bg: rgba(0, 0, 0, 0.78);
      --panel-border: #444444;
      --accent: #4caf50;

      position: relative;
      height: 100%;
      width: 100%;
      background: var(--bg);
      overflow: hidden;
    }

    .precision-map.light-theme {
      --bg: #f5f5f5;
      --text: #212121;
      --text-secondary: #666666;
      --panel-bg: rgba(255, 255, 255, 0.90);
      --panel-border: #cccccc;
      --accent: #2e7d32;
    }

    canvas {
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 2;
    }

    canvas.coord-picker {
      cursor: crosshair !important;
    }

    canvas.transparent-bg {
      background: transparent !important;
    }



    .copy-toast {
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(0, 100, 0, 0.95);
      color: #fff;
      padding: 10px 16px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      opacity: 0;
      transition: all 0.3s;
      pointer-events: none;
    }

    .copy-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .click-hint {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--panel-bg);
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 10px;
      font-family: sans-serif;
      border: 1px solid var(--panel-border);
    }

    .edit-banner {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(124, 77, 255, 0.9);
      color: #fff;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      font-family: sans-serif;
      pointer-events: none;
      z-index: 5;
    }
    .edit-banner.editor-banner {
      background: rgba(124, 131, 255, 0.9);
    }
  `]
})
export class MapControlComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('mapCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() anchorClick = new EventEmitter<string>();

  // ── Map view info output (throttled, ~500ms) ─────────────────
  /** Emits current map center lat/lng, zoom and rotation for external panels */
  @Output() viewInfo = new EventEmitter<{
    lat: number; lng: number; zoom: number; rotDeg: number;
    showSections: boolean; showLabels: boolean;
    showCanvasGrid: boolean; showBoundary: boolean; showMarkers: boolean;
    canvasGridCellW: number; canvasGridCellH: number; canvasGridOpacity: number;
    canvasGridColor: string; canvasGridStyle: 'solid' | 'dashed' | 'dotted';
    canvasGridRotation: number;
  }>();

  // ── Sticker system I/O ────────────────────────────────────
  /** Whether sticker edit mode is active */
  @Input() stickerEditMode = false;
  /** The sticker key from the palette the user wants to place */
  @Input() placingStickerKey: string | null = null;
  /** The sticker layers to render */
  @Input() stickerLayers: StickerLayer[] = [];
  /** Currently selected sticker for property editing */
  @Output() stickerSelectedOnMap = new EventEmitter<StickerInstance | null>();
  /** Sticker was placed on the map (click-to-place with placingStickerKey) */
  @Output() stickerPlaced = new EventEmitter<{ lat: number; lng: number }>();
  /** Sticker was dropped from the panel palette (drag-and-drop) */
  @Output() stickerDroppedOnMap = new EventEmitter<{ key: string; lat: number; lng: number }>();
  /** Sticker was moved on the map */
  @Output() stickerMoved = new EventEmitter<StickerInstance>();

  // ── Layer config I/O ──────────────────────────────────
  /** Request parent to save current map layer configuration */
  @Output() saveRequest = new EventEmitter<void>();
  /** Request parent to load saved map layer configuration */
  @Output() loadRequest = new EventEmitter<void>();
  /** Request parent to clear all stickers */
  @Output() clearRequest = new EventEmitter<void>();

  // ── Tilemap editor overlay I/O ────────────────────────────
  /** Editor layers to draw on top of the park map */
  @Input() editorLayers: TilemapLayer[] = [];
  /** Whether editor mode is active (routes clicks to editor) */
  @Input() editorMode = false;
  /** Currently selected editor item (draws selection handles) */
  @Input() editorSelectedItem: TilemapLayerData | null = null;
  /** Active tool in the editor (affects cursor on canvas) */
  @Input() editorActiveTool = 'select';
  /** Emitted when the map canvas is clicked while editor mode is active */
  @Output() editorGeoClick = new EventEmitter<{ lat: number; lng: number }>();
  /** Emitted on every mouse move (throttled) for editor cursor display */
  @Output() editorGeoMove = new EventEmitter<{ lat: number; lng: number }>();
  /** Emitted on mouse up for editor drag-end notification */
  @Output() editorGeoMouseUp = new EventEmitter<void>();

  private ctx!: CanvasRenderingContext2D;
  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  // Estado del mapa
  private scale = 1.2;
  private targetScale = 1.2;
  private rotation = 0;
  private targetRotation = 0;
  private offsetX = 0;
  private offsetY = 0;

  // Animación
  private animationId: number | null = null;
  private readonly ANIMATION_SPEED = 0.08;
  private readonly STORAGE_KEY = 'pcymt_map_state_v3';

  // Rotación continua
  private rotationInterval: ReturnType<typeof setInterval> | null = null;
  private rotationHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private isRotating = false;
  private readonly ROTATION_STEP = Math.PI / 180; // 1° por frame
  private readonly HOLD_DELAY = 200; // ms antes de empezar rotación continua

  // Tamaños de marcadores
  private readonly MARKER_RADIUS = 10;
  private readonly MARKER_INNER_RADIUS = 4;
  private readonly MARKER_WARNING_RADIUS = 16;

  // Bounds
  private bounds = this.calculateBounds(PARK_BOUNDARY, 0.0002);

  // Datos
  private markers: Marker[] = [];
  private clusters: AnchorCluster[] = [];
  sections = PARK_SECTIONS;

  // UI
  private _cursorLat = LAT_CENTER;
  private _cursorLng = LNG_CENTER;
  showCopyToast = false;
  lastCopiedCoords = '';

  isDarkTheme = true;

  // Opciones del mapa
  mapOptions = {
    showSections: true,
    showLabels: true,
    showCanvasGrid: false,
    showTilemap: true,
    showBoundary: true,
    showMarkers: true
  };

  // Reference image (background layer)
  private refImage: HTMLImageElement | null = null;
  private refImageOpacity = 0.5;
  private refImageLoaded = false;

  // Canvas grid configuration
  canvasGridCellW = 32;
  canvasGridCellH = 32;
  canvasGridOpacity = 0.15;
  canvasGridColor = '';
  canvasGridStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
  /** Grid rotation in degrees relative to screen horizontal (0 = straight, independent of map rotation) */
  canvasGridRotation = 0;

  // ── Tile painting ─────────────────────────────────────────
  @Input() tilePaintMode = false;
  @Input() tilePaintDataUrl: string | null = null;
  @Input() tilePaintTool: string = 'paint';
  @Input() markerRadius = 10;
  /** Multi-tile selection from tileset panel */
  @Input() set tilePaintMultiTiles(val: { col: number; row: number; dataUrl: string }[] | undefined) {
    this.multiTiles = val ?? [];
    this.multiTileCols = val?.length ? Math.max(...val.map(t => t.col)) + 1 : 1;
    this.multiTileRows = val?.length ? Math.max(...val.map(t => t.row)) + 1 : 1;
  }
  /** Emitted when eyedropper picks a tile — contains the dataUrl of the tile */
  @Output() tilePickerPicked = new EventEmitter<string>();
  @Output() tilePaintToolChange = new EventEmitter<string>();

  /** Which layer is currently movable ('canvas' = move all) */
  activeMovableLayer: 'canvas' | 'grid' | 'boundary' | 'sections' | 'markers' = 'canvas';

  /** Per-layer offsets in map-space (used when moving individual layers) */
  layerOffsets = {
    grid:     { x: 0, y: 0 },
    boundary: { x: 0, y: 0 },
    sections: { x: 0, y: 0 },
    markers:  { x: 0, y: 0 },
  };

  /** Saved transform snapshot for locked boundary */
  // lockedBoundaryTransform removed — lock now only prevents layer editing, not panning
  private resizeObserver: ResizeObserver | null = null;
  /** Painted tiles: key = "col,row" → value = tileDataUrl */
  paintedTiles = new Map<string, { url: string; img: HTMLImageElement | null }>();
  private isPainting = false;
  private paintImageCache = new Map<string, HTMLImageElement>();

  // ── Undo / redo ─────────────────────────────────────────
  private undoStack: Map<string, { url: string; img: HTMLImageElement | null }>[] = [];
  private redoStack: Map<string, { url: string; img: HTMLImageElement | null }>[] = [];
  private readonly MAX_UNDO = 50;

  // ── Multi-tile selection (from tileset panel) ──────────
  private multiTiles: { col: number; row: number; dataUrl: string }[] = [];
  private multiTileCols = 1;
  private multiTileRows = 1;

  // ── Line tool state ────────────────────────────────────
  private lineStartCol = -1;
  private lineStartRow = -1;
  private lineDragging = false;
  private lineEndCol = -1;
  private lineEndRow = -1;

  // ── Rectangle paint tool state ─────────────────────────
  private rectStartCol = -1;
  private rectStartRow = -1;
  private rectDragging = false;
  private rectEndCol = -1;
  private rectEndRow = -1;

  // Interacción
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  // ── Sticker interaction state ─────────────────────────────
  private selectedStickerRef: { layerId: string; sticker: StickerInstance } | null = null;
  private isDraggingSticker = false;
  private isScalingSticker = false;
  private scaleDragStartDist = 0;
  private scaleDragStartScale = 1;
  private isRotatingSticker = false;
  private rotateDragStartAngle = 0; // atan2 angle from center to mouse at drag start
  private rotateDragStartStkRot = 0; // sticker rotation (deg) at drag start
  private readonly ROTATE_HANDLE_STEM   = 22; // stem length in screen px
  private readonly ROTATE_HANDLE_RADIUS = 7;  // circle radius in screen px
  private readonly STICKER_BASE_SIZE = 40; // px base size at scale=1 (in screen pixels)
  private readonly HANDLE_RADIUS = 6; // corner handle hit area

  // ── Cursor throttle (hit-test at most every 30ms) ────────
  private lastCursorX = -9999;
  private lastCursorY = -9999;
  private readonly CURSOR_MOVE_THRESHOLD = 4; // px

  // ── Zoom-to-cursor anchor (updated per-frame in animation loop) ──
  private _zoomAnchorX = 0;   // cursor X relative to viewport center
  private _zoomAnchorY = 0;   // cursor Y relative to viewport center
  private _hasZoomAnchor = false;

  /** When true, clicking on the map copies lat/lng coordinates. */
  coordPickerMode = false;

  // ── ViewInfo throttle ─────────────────────────────────────────
  private lastViewInfoTime = 0;

  // Expose selected sticker for template
  get selectedStickerPublic(): StickerInstance | null {
    return this.selectedStickerRef?.sticker ?? null;
  }

  get zoom(): number { return this.scale; }
  get rotationDeg(): number { return this.rotation * 180 / Math.PI; }
  get theme() { return this.isDarkTheme ? THEME_COLORS.dark : THEME_COLORS.light; }

  constructor(
    private anchorService: AnchorPointService,
    private themeService: ThemeManagerService,
    private stickerService: StickerLayerService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadState();
      this.isDarkTheme = this.themeService.isDarkMode();
      this.themeService.themeChanged$
        .pipe(takeUntil(this.destroy$))
        .subscribe(theme => {
          this.isDarkTheme = theme === 'dark';
          this.render();
        });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.loadMarkers();
    this.startAnimationLoop();
    // Emit initial view info after a short delay so the canvas has sized up
    setTimeout(() => this.emitViewInfo(), 300);

    // Observe parent element size changes (e.g. sidenav toggle) to auto-resize canvas
    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(parent);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.saveState();
    this.stopContinuousRotation();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  // === PERSISTENCIA ===

  private loadState(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        this.scale = state.scale ?? 1.2;
        this.targetScale = this.scale;
        this.rotation = state.rotation ?? (-52 * Math.PI / 180);
        this.targetRotation = this.rotation;
        this.offsetX = state.offsetX ?? 0;
        this.offsetY = state.offsetY ?? 0;
        this.mapOptions.showSections = state.showSections ?? true;
        this.mapOptions.showLabels = state.showLabels ?? true;
        this.mapOptions.showCanvasGrid = state.showCanvasGrid ?? false;
        this.mapOptions.showTilemap = state.showTilemap ?? true;
        if (state.canvasGridCellW) this.canvasGridCellW = state.canvasGridCellW;
        if (state.canvasGridCellH) this.canvasGridCellH = state.canvasGridCellH;
        if (state.canvasGridOpacity != null) this.canvasGridOpacity = state.canvasGridOpacity;
      }
    } catch (e) {
      console.warn('Error loading map state:', e);
    }
  }

  private saveState(): void {
    try {
      const state = {
        scale: this.scale,
        rotation: this.rotation,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        showSections: this.mapOptions.showSections,
        showLabels: this.mapOptions.showLabels,
        showCanvasGrid: this.mapOptions.showCanvasGrid,
        showTilemap: this.mapOptions.showTilemap,
        canvasGridCellW: this.canvasGridCellW,
        canvasGridCellH: this.canvasGridCellH,
        canvasGridOpacity: this.canvasGridOpacity
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Error saving map state:', e);
    }
  }

  onOptionChange(): void {
    this.render();
    this.saveState();
  }

  // === ANIMACIÓN ===

  private startAnimationLoop(): void {
    const animate = () => {
      let needsRender = false;

      // Interpolar escala (with zoom-to-cursor anchor adjustment)
      if (Math.abs(this.scale - this.targetScale) > 0.001) {
        const prevScale = this.scale;
        this.scale += (this.targetScale - this.scale) * this.ANIMATION_SPEED;
        if (this._hasZoomAnchor) {
          const r = this.scale / prevScale;
          this.offsetX = this._zoomAnchorX - (this._zoomAnchorX - this.offsetX) * r;
          this.offsetY = this._zoomAnchorY - (this._zoomAnchorY - this.offsetY) * r;
        }
        needsRender = true;
      } else if (this.scale !== this.targetScale) {
        const prevScale = this.scale;
        this.scale = this.targetScale;
        if (this._hasZoomAnchor) {
          const r = this.scale / prevScale;
          this.offsetX = this._zoomAnchorX - (this._zoomAnchorX - this.offsetX) * r;
          this.offsetY = this._zoomAnchorY - (this._zoomAnchorY - this.offsetY) * r;
        }
        this._hasZoomAnchor = false;
        needsRender = true;
      }

      // Interpolar rotación (camino más corto)
      let rotDiff = this.targetRotation - this.rotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

      if (Math.abs(rotDiff) > 0.001) {
        this.rotation += rotDiff * this.ANIMATION_SPEED;
        needsRender = true;
      } else if (this.rotation !== this.targetRotation) {
        this.rotation = this.targetRotation;
        needsRender = true;
      }

      // Rotación continua
      if (this.isRotating) {
        needsRender = true;
      }

      if (needsRender) {
        this.render();
      }

      // Emit view info at most every 500ms when map is moving
      const now = Date.now();
      if (needsRender && (now - this.lastViewInfoTime) > 500) {
        this.lastViewInfoTime = now;
        this.emitViewInfo();
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  @HostListener('window:resize')
  resize(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.render();
  }

  private loadMarkers(): void {
    this.anchorService.getActiveAnchorPoints()
      .pipe(takeUntil(this.destroy$))
      .subscribe((points: AnchorPoint[]) => {
        this.markers = points.map(p => {
          const geo = { lat: Number(p.latitude), lng: Number(p.longitude) };
          return {
            id: p.id,
            name: p.name,
            geo,
            isInsidePark: isPointInPolygon(geo, PARK_BOUNDARY),
            section: (p as any).section
          };
        });
        this.render();
      });

    // Cluster zones disabled to avoid dashed connector overlays on the map
    this.clusters = [];
  }

  private calculateBounds(polygon: GeoPoint[], padding: number) {
    const lats = polygon.map(p => p.lat);
    const lngs = polygon.map(p => p.lng);
    return {
      minLat: Math.min(...lats) - padding,
      maxLat: Math.max(...lats) + padding,
      minLng: Math.min(...lngs) - padding,
      maxLng: Math.max(...lngs) + padding
    };
  }

  // === CONVERSIONES ===

  private geoToCanvas(geo: GeoPoint): CanvasPoint {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const geoW = this.bounds.maxLng - this.bounds.minLng;
    const geoH = this.bounds.maxLat - this.bounds.minLat;
    const latCorrectionFactor = Math.cos(LAT_CENTER * Math.PI / 180);
    const correctedGeoW = geoW * latCorrectionFactor;

    const scaleX = w / correctedGeoW;
    const scaleY = h / geoH;
    const s = Math.min(scaleX, scaleY) * 0.9;

    const cx = w / 2;
    const cy = h / 2;
    const geoMidLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    const geoMidLng = (this.bounds.minLng + this.bounds.maxLng) / 2;

    const relX = (geo.lng - geoMidLng) * latCorrectionFactor * s;
    const relY = (geoMidLat - geo.lat) * s;

    return { x: cx + relX, y: cy + relY };
  }

  private geoToScreen(geo: GeoPoint): CanvasPoint {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const basePoint = this.geoToCanvas(geo);
    const cx = w / 2;
    const cy = h / 2;

    let x = basePoint.x - cx;
    let y = basePoint.y - cy;

    x *= this.scale;
    y *= this.scale;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = cos * x - sin * y;
    const ry = sin * x + cos * y;

    return {
      x: rx + cx + this.offsetX,
      y: ry + cy + this.offsetY
    };
  }

  /** Convert screen coordinates to map-space coordinates (inverse of the map transform). */
  private screenToMap(sx: number, sy: number): { x: number; y: number } {
    const canvasEl = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasEl.width / dpr;
    const h = canvasEl.height / dpr;
    const cx = sx - w / 2 - this.offsetX;
    const cy = sy - h / 2 - this.offsetY;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    return {
      x: (cx * cos - cy * sin) / this.scale + w / 2,
      y: (cx * sin + cy * cos) / this.scale + h / 2
    };
  }

  /** Inverse of the grid’s own render transform (screen → grid-local drawing coords) */
  private screenToGridLocal(sx: number, sy: number): { x: number; y: number } {
    const canvasEl = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasEl.width / dpr;
    const h = canvasEl.height / dpr;
    const gridRad = this.canvasGridRotation * Math.PI / 180;
    const lo = this.layerOffsets.grid;
    const cx = sx - w / 2 - this.offsetX;
    const cy = sy - h / 2 - this.offsetY;
    const cos = Math.cos(-gridRad);
    const sin = Math.sin(-gridRad);
    return {
      x: (cx * cos - cy * sin) / this.scale + w / 2 - lo.x,
      y: (cx * sin + cy * cos) / this.scale + h / 2 - lo.y,
    };
  }

  private canvasToGeo(canvas: CanvasPoint): GeoPoint {
    const canvasEl = this.canvasRef.nativeElement;
    const w = canvasEl.width / (window.devicePixelRatio || 1);
    const h = canvasEl.height / (window.devicePixelRatio || 1);

    const cx = w / 2;
    const cy = h / 2;

    let x = (canvas.x - cx - this.offsetX) / this.scale;
    let y = (canvas.y - cy - this.offsetY) / this.scale;

    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const rx = cos * x - sin * y;
    const ry = sin * x + cos * y;

    const geoW = this.bounds.maxLng - this.bounds.minLng;
    const geoH = this.bounds.maxLat - this.bounds.minLat;
    const latCorrectionFactor = Math.cos(LAT_CENTER * Math.PI / 180);
    const correctedGeoW = geoW * latCorrectionFactor;

    const scaleX = w / correctedGeoW;
    const scaleY = h / geoH;
    const s = Math.min(scaleX, scaleY) * 0.9;

    const geoMidLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    const geoMidLng = (this.bounds.minLng + this.bounds.maxLng) / 2;

    return {
      lat: geoMidLat - ry / s,
      lng: geoMidLng + rx / (latCorrectionFactor * s)
    };
  }

  // === RENDERIZADO ===

  private render(): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Always reset to DPR-only transform to guarantee a clean slate each frame
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fill with theme background
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, w, h);

    // Transformaciones
    this.ctx.save();
    this.ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    this.ctx.rotate(this.rotation);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.translate(-w / 2, -h / 2);

    // Each layer applies its own map-space offset
    if (this.mapOptions.showSections) {
      const lo = this.layerOffsets.sections;
      this.ctx.save(); this.ctx.translate(lo.x, lo.y);
      this.drawSections(w, h);
      this.ctx.restore();
    }
    if (this.mapOptions.showBoundary) {
      const lo = this.layerOffsets.boundary;
      this.ctx.save(); this.ctx.translate(lo.x, lo.y);
      this.drawBoundary(w, h);
      this.ctx.restore();
    }
    if (this.mapOptions.showMarkers) {
      const lo = this.layerOffsets.markers;
      this.ctx.save(); this.ctx.translate(lo.x, lo.y);
      this.drawMarkerDots(w, h);
      this.ctx.restore();
    }

    // Reference image layer — drawn in grid-local space before tiles & grid
    if (this.refImage && this.refImageLoaded && this.refImageOpacity > 0) {
      const lo = this.layerOffsets.grid;
      const gridRad = this.canvasGridRotation * Math.PI / 180;
      this.ctx.save();
      this.ctx.translate(w / 2, h / 2);
      this.ctx.rotate(-this.rotation + gridRad);
      this.ctx.translate(-w / 2, -h / 2);
      this.ctx.translate(lo.x, lo.y);
      this.ctx.globalAlpha = this.refImageOpacity;
      this.ctx.drawImage(this.refImage, 0, 0);
      this.ctx.globalAlpha = 1;
      this.ctx.restore();
    }

    // Painted tilemap layer — always renders if tiles exist and showTilemap is true
    if (this.mapOptions.showTilemap && this.paintedTiles.size > 0) {
      const lo = this.layerOffsets.grid;
      const gridRad = this.canvasGridRotation * Math.PI / 180;
      this.ctx.save();
      this.ctx.translate(w / 2, h / 2);
      this.ctx.rotate(-this.rotation + gridRad);
      this.ctx.translate(-w / 2, -h / 2);
      this.ctx.translate(lo.x, lo.y);
      this.drawPaintedTilesLayer();
      this.ctx.restore();
    }

    // Canvas grid lines: independent rotation, screen-aligned by default (gridRotation=0)
    if (this.mapOptions.showCanvasGrid) {
      const lo = this.layerOffsets.grid;
      const gridRad = this.canvasGridRotation * Math.PI / 180;
      this.ctx.save();
      this.ctx.translate(w / 2, h / 2);
      this.ctx.rotate(-this.rotation + gridRad);
      this.ctx.translate(-w / 2, -h / 2);
      this.ctx.translate(lo.x, lo.y);
      this.drawCanvasGrid();
      this.ctx.restore();
    }

    // Rectangle/line selection preview for paint tools
    if (this.rectDragging || this.lineDragging) {
      const lo = this.layerOffsets.grid;
      const gridRad = this.canvasGridRotation * Math.PI / 180;
      this.ctx.save();
      this.ctx.translate(w / 2, h / 2);
      this.ctx.rotate(-this.rotation + gridRad);
      this.ctx.translate(-w / 2, -h / 2);
      this.ctx.translate(lo.x, lo.y);
      this.drawRectPreview();
      this.drawLinePreview();
      this.ctx.restore();
    }

    this.ctx.restore();

    // Sticker layers (drawn after main transform restore, using geoToScreen)
    this.drawStickers();

    // Editor overlay layers (drawn on top of everything using geoToScreen)
    if (this.editorLayers?.length) this.drawEditorOverlay();

    // Marker labels (screen-space) — shift by markers layer offset converted to screen delta
    if (this.mapOptions.showMarkers && this.mapOptions.showLabels) {
      const lo = this.layerOffsets.markers;
      if (lo.x !== 0 || lo.y !== 0) {
        const s = this.scale;
        const c = Math.cos(this.rotation);
        const sn = Math.sin(this.rotation);
        const sdx = (lo.x * c - lo.y * sn) * s;
        const sdy = (lo.x * sn + lo.y * c) * s;
        this.ctx.save();
        this.ctx.translate(sdx, sdy);
        this.drawMarkerLabels();
        this.ctx.restore();
      } else {
        this.drawMarkerLabels();
      }
    }
  }

  private drawGrid(w: number, h: number): void {
    this.ctx.strokeStyle = this.theme.grid;
    this.ctx.lineWidth = 0.5 / this.scale;
    this.ctx.font = `${9 / this.scale}px monospace`;
    this.ctx.fillStyle = this.theme.gridText;

    const interval = 0.0005;
    const startLat = Math.ceil(this.bounds.minLat / interval) * interval;
    const startLng = Math.ceil(this.bounds.minLng / interval) * interval;

    for (let lat = startLat; lat <= this.bounds.maxLat; lat += interval) {
      const p1 = this.geoToCanvas({ lat, lng: this.bounds.minLng });
      const p2 = this.geoToCanvas({ lat, lng: this.bounds.maxLng });
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }

    for (let lng = startLng; lng <= this.bounds.maxLng; lng += interval) {
      const p1 = this.geoToCanvas({ lat: this.bounds.minLat, lng });
      const p2 = this.geoToCanvas({ lat: this.bounds.maxLat, lng });
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }
  }

  private drawSections(w: number, h: number): void {
    PARK_SECTIONS.forEach(section => {
      if (section.polygon.length < 3) return;

      const points = section.polygon.map(g => this.geoToCanvas(g));
      const fillColor = this.isDarkTheme ? section.color : section.colorLight;

      this.ctx.fillStyle = fillColor;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    });
  }

  private drawBoundary(w: number, h: number): void {
    if (PARK_BOUNDARY.length < 3) return;

    const points = PARK_BOUNDARY.map(g => this.geoToCanvas(g));

    // Relleno
    this.ctx.fillStyle = this.theme.boundaryFill;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Contorno
    this.ctx.strokeStyle = this.theme.boundary;
    this.ctx.lineWidth = 2 / this.scale;
    this.ctx.stroke();

    // Vértices
    const vertexRadius = 2 / this.scale;
    this.ctx.fillStyle = this.theme.text;
    points.forEach((p) => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, vertexRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private drawMarkerDots(w: number, h: number): void {
    const mRadius = this.markerRadius || this.MARKER_RADIUS;
    const markerRadius = mRadius / this.scale;
    const innerRadius = (mRadius * 0.4) / this.scale;
    const warningRadius = (mRadius * 1.6) / this.scale;

    this.markers.forEach(marker => {
      const p = this.geoToCanvas(marker.geo);
      const isInside = marker.isInsidePark;

      if (!isInside) {
        this.ctx.strokeStyle = this.theme.markerOutside;
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([3 / this.scale, 3 / this.scale]);
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, warningRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      this.ctx.fillStyle = isInside ? this.theme.markerInside : this.theme.markerOutside;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, markerRadius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = this.theme.text;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, innerRadius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  /**
   * Draws semi-transparent polygon zones for clusters (multiple anchors
   * sharing the same virtual asset). Uses a convex hull polygon when 3+
   * points exist, a dashed capsule for 2 points, or a pulsing ring for 1.
   */
  private drawClusterZones(w: number, h: number): void {
    if (!this.clusters || this.clusters.length === 0) return;

    // Section-based color map
    const clusterColors: Record<string, { fill: string; stroke: string }> = {
      'Tierras Altas':    { fill: 'rgba(139, 90, 43, 0.18)',  stroke: 'rgba(139, 90, 43, 0.6)' },
      'Tierras Medias':   { fill: 'rgba(76, 175, 80, 0.18)',  stroke: 'rgba(76, 175, 80, 0.6)' },
      'Tierras Bajas':    { fill: 'rgba(255, 193, 7, 0.18)',   stroke: 'rgba(255, 193, 7, 0.6)' },
      'Mitos y Leyendas': { fill: 'rgba(103, 58, 183, 0.18)', stroke: 'rgba(103, 58, 183, 0.6)' },
    };
    const defaultColor = { fill: 'rgba(33, 150, 243, 0.18)', stroke: 'rgba(33, 150, 243, 0.6)' };

    this.clusters.forEach(cluster => {
      const colors = clusterColors[cluster.section] || defaultColor;

      if (cluster.polygon && cluster.polygon.length >= 3) {
        // Draw convex hull polygon with padding
        const points = cluster.polygon.map(p => this.geoToCanvas({ lat: p.lat, lng: p.lng }));

        this.ctx.fillStyle = colors.fill;
        this.ctx.strokeStyle = colors.stroke;
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw count badge at centroid
        const center = this.geoToCanvas(cluster.center);
        const fontSize = 12 / this.scale;
        this.ctx.font = `bold ${fontSize}px sans-serif`;
        const label = `×${cluster.count}`;
        const metrics = this.ctx.measureText(label);
        const badgeW = metrics.width + 8 / this.scale;
        const badgeH = fontSize + 6 / this.scale;

        this.ctx.fillStyle = colors.stroke;
        this.ctx.beginPath();
        this.ctx.roundRect(
          center.x - badgeW / 2, center.y - badgeH / 2,
          badgeW, badgeH, 4 / this.scale
        );
        this.ctx.fill();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, center.x, center.y);

      } else if (cluster.locations.length === 2) {
        // Two points — draw connecting dashed line with zone
        const p1 = this.geoToCanvas({ lat: cluster.locations[0].latitude, lng: cluster.locations[0].longitude });
        const p2 = this.geoToCanvas({ lat: cluster.locations[1].latitude, lng: cluster.locations[1].longitude });

        this.ctx.strokeStyle = colors.stroke;
        this.ctx.lineWidth = 3 / this.scale;
        this.ctx.setLineDash([6 / this.scale, 4 / this.scale]);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });
  }

  // === CANVAS GRID (full-canvas, configurable) ===

  private drawCanvasGrid(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const ctx = this.ctx;
    const cellW = Math.max(1, this.canvasGridCellW);
    const cellH = Math.max(1, this.canvasGridCellH);
    const opacity = Math.max(0, Math.min(1, this.canvasGridOpacity));

    // Compute visible bounds in grid-local drawing coordinates (accounts for grid rotation)
    const tl = this.screenToGridLocal(0, 0);
    const tr = this.screenToGridLocal(w, 0);
    const bl = this.screenToGridLocal(0, h);
    const br = this.screenToGridLocal(w, h);
    const minX = Math.min(tl.x, tr.x, bl.x, br.x);
    const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
    const minY = Math.min(tl.y, tr.y, bl.y, br.y);
    const maxY = Math.max(tl.y, tr.y, bl.y, br.y);

    // Snap to cell boundaries
    const startCol = Math.floor(minX / cellW);
    const endCol = Math.ceil(maxX / cellW);
    const startRow = Math.floor(minY / cellH);
    const endRow = Math.ceil(maxY / cellH);

    // Grid lines only (painted tiles are now a separate layer)
    if (this.canvasGridColor) {
      const r = parseInt(this.canvasGridColor.slice(1, 3), 16);
      const g = parseInt(this.canvasGridColor.slice(3, 5), 16);
      const b = parseInt(this.canvasGridColor.slice(5, 7), 16);
      ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
    } else {
      ctx.strokeStyle = this.isDarkTheme
        ? `rgba(255,255,255,${opacity})`
        : `rgba(0,0,0,${opacity})`;
    }
    ctx.lineWidth = 0.5 / this.scale;

    switch (this.canvasGridStyle) {
      case 'dashed': ctx.setLineDash([6 / this.scale, 4 / this.scale]); break;
      case 'dotted': ctx.setLineDash([1 / this.scale, 3 / this.scale]); break;
      default: ctx.setLineDash([]); break;
    }

    for (let c = startCol; c <= endCol; c++) {
      const x = c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    }
    for (let r = startRow; r <= endRow; r++) {
      const y = r * cellH;
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawPaintedTiles(ctx: CanvasRenderingContext2D, startCol: number, startRow: number, endCol: number, endRow: number, cellW: number, cellH: number): void {
    if (this.paintedTiles.size === 0) return;
    this.paintedTiles.forEach((tile, key) => {
      if (!tile.img) return;
      const [cs, rs] = key.split(',');
      const col = parseInt(cs, 10);
      const row = parseInt(rs, 10);
      if (col < startCol || col > endCol || row < startRow || row > endRow) return;
      const x = col * cellW;
      const y = row * cellH;
      ctx.drawImage(tile.img, x, y, cellW, cellH);
    });
  }

  /** Standalone method to render painted tiles layer (called from render()) */
  private drawPaintedTilesLayer(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cellW = Math.max(1, this.canvasGridCellW);
    const cellH = Math.max(1, this.canvasGridCellH);
    const tl = this.screenToGridLocal(0, 0);
    const tr = this.screenToGridLocal(w, 0);
    const bl = this.screenToGridLocal(0, h);
    const br = this.screenToGridLocal(w, h);
    const minX = Math.min(tl.x, tr.x, bl.x, br.x);
    const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
    const minY = Math.min(tl.y, tr.y, bl.y, br.y);
    const maxY = Math.max(tl.y, tr.y, bl.y, br.y);
    const startCol = Math.floor(minX / cellW);
    const endCol = Math.ceil(maxX / cellW);
    const startRow = Math.floor(minY / cellH);
    const endRow = Math.ceil(maxY / cellH);
    this.drawPaintedTiles(this.ctx, startCol, startRow, endCol, endRow, cellW, cellH);
  }

  setCanvasGridDivisions(divisions: number): void {
    // Legacy compat: convert divisions to cell size
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      this.canvasGridCellW = Math.round(w / Math.max(2, Math.min(100, divisions)));
      this.canvasGridCellH = this.canvasGridCellW;
    }
    this.onOptionChange();
  }

  setCanvasGridCellSize(cellW: number, cellH: number): void {
    this.canvasGridCellW = Math.max(1, Math.min(512, cellW));
    this.canvasGridCellH = Math.max(1, Math.min(512, cellH));
    this.onOptionChange();
  }

  setCanvasGridOpacity(opacity: number): void {
    this.canvasGridOpacity = Math.max(0, Math.min(1, opacity));
    this.onOptionChange();
  }

  setCanvasGridColor(color: string): void {
    this.canvasGridColor = color;
    this.onOptionChange();
  }

  setCanvasGridStyle(style: 'solid' | 'dashed' | 'dotted'): void {
    this.canvasGridStyle = style;
    this.onOptionChange();
  }

  setCanvasGridRotation(degrees: number): void {
    this.canvasGridRotation = degrees;
    this.onOptionChange();
  }

  /** Load a reference image from a data URL or blob URL */
  setRefImage(dataUrl: string | null): void {
    if (!dataUrl) {
      this.refImage = null;
      this.refImageLoaded = false;
      this.render();
      return;
    }
    const img = new Image();
    img.onload = () => { this.refImageLoaded = true; this.render(); };
    img.src = dataUrl;
    this.refImage = img;
    this.refImageLoaded = false;
  }

  setRefImageOpacity(opacity: number): void {
    this.refImageOpacity = Math.max(0, Math.min(1, opacity));
    this.render();
  }

  // ── Tile painting helpers ─────────────────────────────────

  private paintAtScreenPos(screenX: number, screenY: number): void {
    const cellW = Math.max(1, this.canvasGridCellW);
    const cellH = Math.max(1, this.canvasGridCellH);
    const mp = this.screenToGridLocal(screenX, screenY);
    const col = Math.floor(mp.x / cellW);
    const row = Math.floor(mp.y / cellH);

    if (this.tilePaintTool === 'eraser') {
      const key = `${col},${row}`;
      if (this.paintedTiles.has(key)) {
        this.paintedTiles.delete(key);
        this.render();
      }
      return;
    }
    if (this.tilePaintTool === 'picker') {
      const key = `${col},${row}`;
      const tile = this.paintedTiles.get(key);
      if (tile) this.tilePickerPicked.emit(tile.url);
      return;
    }
    if (!this.tilePaintDataUrl) return;

    // Multi-tile painting: stamp the multi-tile selection pattern
    if (this.multiTiles.length > 1) {
      let changed = false;
      for (const mt of this.multiTiles) {
        const tc = col + mt.col;
        const tr = row + mt.row;
        const key = `${tc},${tr}`;
        const existing = this.paintedTiles.get(key);
        if (existing && existing.url === mt.dataUrl) continue;
        let img = this.paintImageCache.get(mt.dataUrl) ?? null;
        if (!img) { img = new Image(); img.src = mt.dataUrl; this.paintImageCache.set(mt.dataUrl, img); img.onload = () => this.render(); }
        this.paintedTiles.set(key, { url: mt.dataUrl, img: img.complete ? img : null });
        changed = true;
      }
      if (changed) this.render();
      return;
    }

    // Single tile painting
    const key = `${col},${row}`;
    const existing = this.paintedTiles.get(key);
    if (existing && existing.url === this.tilePaintDataUrl) return;
    let img = this.paintImageCache.get(this.tilePaintDataUrl) ?? null;
    if (!img) { img = new Image(); img.src = this.tilePaintDataUrl; this.paintImageCache.set(this.tilePaintDataUrl, img); img.onload = () => this.render(); }
    this.paintedTiles.set(key, { url: this.tilePaintDataUrl, img: img.complete ? img : null });
    if (img.complete) this.render();
  }

  // ── Undo / Redo ─────────────────────────────────────────
  private pushUndo(): void {
    this.undoStack.push(new Map(this.paintedTiles));
    if (this.undoStack.length > this.MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(new Map(this.paintedTiles));
    this.paintedTiles = this.undoStack.pop()!;
    this.render();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(new Map(this.paintedTiles));
    this.paintedTiles = this.redoStack.pop()!;
    this.render();
  }

  // ── Bucket fill (flood fill) ────────────────────────────
  private bucketFill(startCol: number, startRow: number): void {
    if (!this.tilePaintDataUrl) return;
    const targetUrl = this.paintedTiles.get(`${startCol},${startRow}`)?.url ?? null;
    if (targetUrl === this.tilePaintDataUrl) return;

    let img = this.paintImageCache.get(this.tilePaintDataUrl) ?? null;
    if (!img) { img = new Image(); img.src = this.tilePaintDataUrl; this.paintImageCache.set(this.tilePaintDataUrl, img); img.onload = () => this.render(); }

    const stack: [number, number][] = [[startCol, startRow]];
    const visited = new Set<string>();
    const MAX_FILL = 5000;
    let count = 0;

    while (stack.length > 0 && count < MAX_FILL) {
      const [c, r] = stack.pop()!;
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const cellUrl = this.paintedTiles.get(key)?.url ?? null;
      if (cellUrl !== targetUrl) continue;
      this.paintedTiles.set(key, { url: this.tilePaintDataUrl!, img: img!.complete ? img : null });
      count++;
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    this.render();
  }

  clearPaintedTiles(): void {
    this.pushUndo();
    this.paintedTiles.clear();
    this.render();
  }

  /** Set which layer is currently movable for independent dragging */
  setActiveMovableLayer(layer: 'canvas' | 'grid' | 'boundary' | 'sections' | 'markers'): void {
    this.activeMovableLayer = layer;
    this.render();
  }

  /** Fill all cells in a bounding rectangle with the current tile (or erase, supports multi-tile) */
  private fillRect(c1: number, r1: number, c2: number, r2: number): void {
    if (this.multiTiles.length > 1) {
      // Multi-tile: stamp the pattern tiling across the rect
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const mt = this.multiTiles.find(t => t.col === ((c - c1) % this.multiTileCols) && t.row === ((r - r1) % this.multiTileRows));
          const url = mt?.dataUrl ?? this.tilePaintDataUrl;
          if (!url) continue;
          const key = `${c},${r}`;
          if (this.tilePaintTool === 'eraser') { this.paintedTiles.delete(key); continue; }
          let img = this.paintImageCache.get(url) ?? null;
          if (!img) { img = new Image(); img.src = url; this.paintImageCache.set(url, img); img.onload = () => this.render(); }
          this.paintedTiles.set(key, { url, img: img.complete ? img : null });
        }
      }
    } else {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const key = `${c},${r}`;
          if (this.tilePaintTool === 'eraser') {
            this.paintedTiles.delete(key);
          } else if (this.tilePaintDataUrl) {
            let img = this.paintImageCache.get(this.tilePaintDataUrl) ?? null;
            if (!img) { img = new Image(); img.src = this.tilePaintDataUrl; this.paintImageCache.set(this.tilePaintDataUrl, img); img.onload = () => this.render(); }
            this.paintedTiles.set(key, { url: this.tilePaintDataUrl, img: img.complete ? img : null });
          }
        }
      }
    }
  }

  /** Fill cells along a Bresenham line */
  private fillLine(c1: number, r1: number, c2: number, r2: number): void {
    const dx = Math.abs(c2 - c1);
    const dy = Math.abs(r2 - r1);
    const sx = c1 < c2 ? 1 : -1;
    const sy = r1 < r2 ? 1 : -1;
    let err = dx - dy;
    let c = c1, r = r1;
    while (true) {
      const key = `${c},${r}`;
      if (this.tilePaintTool === 'eraser') {
        this.paintedTiles.delete(key);
      } else if (this.tilePaintDataUrl) {
        let img = this.paintImageCache.get(this.tilePaintDataUrl) ?? null;
        if (!img) { img = new Image(); img.src = this.tilePaintDataUrl; this.paintImageCache.set(this.tilePaintDataUrl, img); img.onload = () => this.render(); }
        this.paintedTiles.set(key, { url: this.tilePaintDataUrl, img: img.complete ? img : null });
      }
      if (c === c2 && r === r2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; c += sx; }
      if (e2 < dx) { err += dx; r += sy; }
    }
  }

  /** Draw a semi-transparent rectangle preview during rect tool drag */
  private drawRectPreview(): void {
    const cellW = Math.max(1, this.canvasGridCellW);
    const cellH = Math.max(1, this.canvasGridCellH);
    const c1 = Math.min(this.rectStartCol, this.rectEndCol);
    const r1 = Math.min(this.rectStartRow, this.rectEndRow);
    const c2 = Math.max(this.rectStartCol, this.rectEndCol);
    const r2 = Math.max(this.rectStartRow, this.rectEndRow);

    this.ctx.fillStyle = 'rgba(124, 77, 255, 0.18)';
    this.ctx.strokeStyle = 'rgba(124, 77, 255, 0.8)';
    this.ctx.lineWidth = 1.5 / this.scale;
    this.ctx.setLineDash([4 / this.scale, 3 / this.scale]);
    const rx = c1 * cellW;
    const ry = r1 * cellH;
    const rw = (c2 - c1 + 1) * cellW;
    const rh = (r2 - r1 + 1) * cellH;
    this.ctx.fillRect(rx, ry, rw, rh);
    this.ctx.strokeRect(rx + 0.5 / this.scale, ry + 0.5 / this.scale, rw, rh);
    this.ctx.setLineDash([]);
  }

  /** Draw a line preview during line tool drag */
  private drawLinePreview(): void {
    if (!this.lineDragging) return;
    const cellW = Math.max(1, this.canvasGridCellW);
    const cellH = Math.max(1, this.canvasGridCellH);

    // Draw preview cells along the Bresenham line
    const dx = Math.abs(this.lineEndCol - this.lineStartCol);
    const dy = Math.abs(this.lineEndRow - this.lineStartRow);
    const sx = this.lineStartCol < this.lineEndCol ? 1 : -1;
    const sy = this.lineStartRow < this.lineEndRow ? 1 : -1;
    let err = dx - dy;
    let c = this.lineStartCol, r = this.lineStartRow;

    this.ctx.fillStyle = 'rgba(124, 77, 255, 0.25)';
    this.ctx.strokeStyle = 'rgba(124, 77, 255, 0.8)';
    this.ctx.lineWidth = 1 / this.scale;
    while (true) {
      this.ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      this.ctx.strokeRect(c * cellW + 0.5 / this.scale, r * cellH + 0.5 / this.scale, cellW, cellH);
      if (c === this.lineEndCol && r === this.lineEndRow) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; c += sx; }
      if (e2 < dx) { err += dx; r += sy; }
    }
  }

  private drawMarkerLabels(): void {
    if (!this.mapOptions.showLabels) return;

    this.markers.forEach(marker => {
      const screenPos = this.geoToScreen(marker.geo);
      const isInside = marker.isInsidePark;

      this.ctx.font = 'bold 11px sans-serif';
      const textMetrics = this.ctx.measureText(marker.name);
      const textWidth = textMetrics.width + 10;
      const textHeight = 16;

      this.ctx.fillStyle = isInside
        ? (this.isDarkTheme ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)')
        : 'rgba(80, 0, 0, 0.9)';
      this.ctx.beginPath();
      this.ctx.roundRect(screenPos.x - textWidth / 2, screenPos.y - 32, textWidth, textHeight, 4);
      this.ctx.fill();

      this.ctx.fillStyle = isInside ? this.theme.text : '#ffcccc';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(marker.name, screenPos.x, screenPos.y - 24);

      if (!isInside) {
        this.ctx.fillStyle = '#ff6666';
        this.ctx.font = '9px sans-serif';
        this.ctx.fillText('⚠ FUERA', screenPos.x, screenPos.y + 22);
      }
    });
  }

  private drawScale(w: number, h: number): void {
    const scaleBarWidth = 100;
    const x = w - scaleBarWidth - 20;
    const y = h - 30;

    const degreesPerPixel = (this.bounds.maxLng - this.bounds.minLng) / w / this.scale;
    const metersPerPixel = degreesPerPixel * METERS_PER_DEG_LNG;
    const meters = Math.round(scaleBarWidth * metersPerPixel);

    this.ctx.fillStyle = this.isDarkTheme ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    this.ctx.fillRect(x - 5, y - 18, scaleBarWidth + 10, 28);

    this.ctx.fillStyle = this.theme.scale;
    this.ctx.fillRect(x, y, scaleBarWidth, 4);

    this.ctx.fillStyle = this.theme.text;
    this.ctx.font = '11px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillText(`${meters}m`, x + scaleBarWidth / 2, y - 5);
  }

  // === STICKERS ===

  /**
   * Draw all visible sticker layers on the canvas.
   * Stickers are drawn in WORLD SPACE (inside the map transform) so they
   * scale naturally with the zoom level — bigger when zoomed in, smaller when out.
   * Selection chrome (dashes, handles) uses 1/scale compensation to stay at a
   * constant screen-pixel size for usability.
   */
  private drawStickers(): void {
    if (!this.stickerLayers || this.stickerLayers.length === 0) return;

    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    for (const layer of this.stickerLayers) {
      if (!layer.visible) continue;

      for (const sticker of layer.stickers) {
        const img = this.stickerService.getCachedImage(sticker.stickerKey);
        if (!img) {
          this.stickerService.loadImage(sticker.stickerKey).then(() => this.render()).catch(() => {});
          continue;
        }

        // World-space position (pre-zoom coordinates)
        const pos = this.geoToCanvas({ lat: sticker.lat, lng: sticker.lng });
        const size = this.STICKER_BASE_SIZE * sticker.scale;
        const aspect = img.naturalWidth / img.naturalHeight;
        const drawW = aspect >= 1 ? size : size * aspect;
        const drawH = aspect >= 1 ? size / aspect : size;
        // Inverse scale: keep UI chrome at constant screen pixel size
        const inv = 1 / this.scale;

        this.ctx.save();
        // Reapply the world transform (same as render())
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
        this.ctx.rotate(this.rotation);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.translate(-w / 2, -h / 2);
        // Move to sticker geo position
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(sticker.rotation * Math.PI / 180);
        this.ctx.globalAlpha = layer.opacity ?? 1;
        this.ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

        // Selection indicator (chrome drawn in screen-invariant world units)
        if (this.selectedStickerRef?.sticker.id === sticker.id && this.stickerEditMode) {
          this.ctx.globalAlpha = 1;
          const pad = 4 * inv;  // 4 screen px in world coords
          this.ctx.strokeStyle = '#7c4dff';
          this.ctx.lineWidth = 2 * inv;
          this.ctx.setLineDash([4 * inv, 4 * inv]);
          this.ctx.strokeRect(-drawW / 2 - pad, -drawH / 2 - pad, drawW + 2 * pad, drawH + 2 * pad);
          this.ctx.setLineDash([]);

          // Corner handles
          const r = 6 * inv;
          const cr = 3 * inv;
          const corners = [
            [-drawW / 2 - pad, -drawH / 2 - pad],
            [ drawW / 2 + pad, -drawH / 2 - pad],
            [-drawW / 2 - pad,  drawH / 2 + pad],
            [ drawW / 2 + pad,  drawH / 2 + pad]
          ];
          for (const [cx, cy] of corners) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#7c4dff';
            this.ctx.lineWidth = 2 * inv;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.lineWidth = 1.5 * inv;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - cr, cy - cr); this.ctx.lineTo(cx + cr, cy + cr);
            this.ctx.moveTo(cx + cr, cy - cr); this.ctx.lineTo(cx - cr, cy + cr);
            this.ctx.stroke();
          }

          // Rotation handle — stem + filled circle above top of bounding box
          const stemInv = this.ROTATE_HANDLE_STEM * inv;
          const rhr    = this.ROTATE_HANDLE_RADIUS * inv;
          const stemBaseY = -(drawH / 2 + pad);
          this.ctx.strokeStyle = '#7c4dff';
          this.ctx.lineWidth = 2 * inv;
          this.ctx.beginPath();
          this.ctx.moveTo(0, stemBaseY);
          this.ctx.lineTo(0, stemBaseY - stemInv - rhr);
          this.ctx.stroke();
          // Handle circle
          const hcy = stemBaseY - stemInv - rhr;
          this.ctx.fillStyle = '#7c4dff';
          this.ctx.beginPath();
          this.ctx.arc(0, hcy, rhr, 0, Math.PI * 2);
          this.ctx.fill();
          // Inner arc symbol
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5 * inv;
          const ir = rhr * 0.5;
          this.ctx.beginPath();
          this.ctx.arc(0, hcy, ir, -Math.PI * 0.75, Math.PI * 0.75);
          this.ctx.stroke();
          // tiny arrowhead at arc end
          const ae = { x: Math.cos(Math.PI * 0.75) * ir, y: hcy + Math.sin(Math.PI * 0.75) * ir };
          const at = 2 * inv;
          this.ctx.beginPath();
          this.ctx.moveTo(ae.x - at, ae.y); this.ctx.lineTo(ae.x + at, ae.y - at * 1.5);
          this.ctx.stroke();

          // Center move icon
          const mr = 10 * inv;
          const asz = 5 * inv;
          this.ctx.fillStyle = 'rgba(124, 77, 255, 0.3)';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, mr, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#7c4dff';
          this.ctx.lineWidth = 1.5 * inv;
          this.ctx.beginPath();
          this.ctx.moveTo(0, -asz); this.ctx.lineTo(0, asz);
          this.ctx.moveTo(-asz, 0); this.ctx.lineTo(asz, 0);
          const arr = 2 * inv;
          this.ctx.moveTo(0, -asz); this.ctx.lineTo(-arr, -asz + 3 * inv); this.ctx.moveTo(0, -asz); this.ctx.lineTo(arr, -asz + 3 * inv);
          this.ctx.moveTo(0, asz);  this.ctx.lineTo(-arr,  asz - 3 * inv); this.ctx.moveTo(0, asz);  this.ctx.lineTo(arr,  asz - 3 * inv);
          this.ctx.moveTo(-asz, 0); this.ctx.lineTo(-asz + 3 * inv, -arr); this.ctx.moveTo(-asz, 0); this.ctx.lineTo(-asz + 3 * inv, arr);
          this.ctx.moveTo(asz, 0);  this.ctx.lineTo(asz - 3 * inv, -arr);  this.ctx.moveTo(asz, 0);  this.ctx.lineTo(asz - 3 * inv, arr);
          this.ctx.stroke();
        }

        this.ctx.restore();
      }
    }
  }

  /**
   * Get the screen-space bounding box of a sticker.
   */
  private getStickerScreenBounds(sticker: StickerInstance): { cx: number; cy: number; halfW: number; halfH: number } | null {
    const img = this.stickerService.getCachedImage(sticker.stickerKey);
    if (!img) return null;
    const screen = this.geoToScreen({ lat: sticker.lat, lng: sticker.lng });
    // Stickers are in world space: world size × zoom = screen pixels
    const size = this.STICKER_BASE_SIZE * sticker.scale * this.scale;
    const aspect = img.naturalWidth / img.naturalHeight;
    const halfW = (aspect >= 1 ? size : size * aspect) / 2;
    const halfH = (aspect >= 1 ? size / aspect : size) / 2;
    return { cx: screen.x, cy: screen.y, halfW, halfH };
  }

  /**
   * Returns true if (screenX, screenY) is near the rotation handle above
   * the selected sticker, correctly accounting for map + sticker rotation.
   */
  private isNearRotateHandle(screenX: number, screenY: number): boolean {
    if (!this.selectedStickerRef) return false;
    const sticker = this.selectedStickerRef.sticker;
    const img = this.stickerService.getCachedImage(sticker.stickerKey);
    if (!img) return false;

    const center = this.geoToScreen({ lat: sticker.lat, lng: sticker.lng });

    // Half-height in world units, then project to screen
    const size  = this.STICKER_BASE_SIZE * sticker.scale;
    const aspect = img.naturalWidth / img.naturalHeight;
    const halfH  = (aspect >= 1 ? size / aspect : size) / 2;
    const pad    = 4; // screen px
    // Total offset from center upward (screen px), along sticker+map rotated axis
    const totalOff = halfH * this.scale + pad + this.ROTATE_HANDLE_STEM + this.ROTATE_HANDLE_RADIUS;

    // Up direction in screen space: start with world-up (0,-1), rotate by sticker then map
    const stkRad = sticker.rotation * Math.PI / 180;
    // sticker local up: rotate (0,-1) by stkRad → (-sin(stkRad), -cos(stkRad))
    let ux = -Math.sin(stkRad);
    let uy = -Math.cos(stkRad);
    // then rotate by map rotation
    const cosM = Math.cos(this.rotation);
    const sinM = Math.sin(this.rotation);
    const rux  = cosM * ux - sinM * uy;
    const ruy  = sinM * ux + cosM * uy;

    const hcx = center.x + rux * totalOff;
    const hcy = center.y + ruy * totalOff;

    const dx = screenX - hcx;
    const dy = screenY - hcy;
    return Math.sqrt(dx * dx + dy * dy) <= this.ROTATE_HANDLE_RADIUS + 3;
  }

  /**
   * Returns true if (screenX, screenY) is within HANDLE_RADIUS of any corner
   * handle of the selected sticker, correctly accounting for both map rotation
   * and the sticker's own rotation.
   */
  private isNearCornerHandle(screenX: number, screenY: number): boolean {
    if (!this.selectedStickerRef) return false;
    const sticker = this.selectedStickerRef.sticker;
    const img = this.stickerService.getCachedImage(sticker.stickerKey);
    if (!img) return false;

    // Sticker center in screen space (already accounts for map rotation)
    const center = this.geoToScreen({ lat: sticker.lat, lng: sticker.lng });

    // Translate mouse relative to sticker center
    let dx = screenX - center.x;
    let dy = screenY - center.y;

    // Unrotate by map rotation
    const cosMap = Math.cos(-this.rotation);
    const sinMap = Math.sin(-this.rotation);
    let rx = cosMap * dx - sinMap * dy;
    let ry = sinMap * dx + cosMap * dy;

    // Unscale to world (canvas) units
    rx /= this.scale;
    ry /= this.scale;

    // Unrotate by sticker's own rotation
    const stkRad = -(sticker.rotation * Math.PI / 180);
    const cosStk = Math.cos(stkRad);
    const sinStk = Math.sin(stkRad);
    const lx = cosStk * rx - sinStk * ry;
    const ly = sinStk * rx + cosStk * ry;

    // Half-sizes in world units (before zoom)
    const size = this.STICKER_BASE_SIZE * sticker.scale;
    const aspect = img.naturalWidth / img.naturalHeight;
    const halfW = (aspect >= 1 ? size : size * aspect) / 2;
    const halfH = (aspect >= 1 ? size / aspect : size) / 2;
    const pad = 4 / this.scale;            // 4 screen-px in world units
    const hitR = (this.HANDLE_RADIUS + 2) / this.scale;

    const corners: [number, number][] = [
      [-halfW - pad, -halfH - pad],
      [ halfW + pad, -halfH - pad],
      [-halfW - pad,  halfH + pad],
      [ halfW + pad,  halfH + pad],
    ];

    for (const [cx, cy] of corners) {
      if (Math.sqrt((lx - cx) ** 2 + (ly - cy) ** 2) <= hitR) return true;
    }
    return false;
  }

  /**
   * Hit-test the corner handles of the selected sticker.
   * Returns true if a corner was hit and starts scaling mode.
   */
  private hitTestCornerHandle(screenX: number, screenY: number): boolean {
    if (!this.isNearCornerHandle(screenX, screenY)) return false;
    const center = this.geoToScreen({
      lat: this.selectedStickerRef!.sticker.lat,
      lng: this.selectedStickerRef!.sticker.lng
    });
    this.isScalingSticker = true;
    this.scaleDragStartDist = Math.sqrt(
      (screenX - center.x) ** 2 + (screenY - center.y) ** 2
    );
    this.scaleDragStartScale = this.selectedStickerRef!.sticker.scale;
    return true;
  }

  /**
   * Hit-test stickers at a screen position.
   * Returns the first sticker hit (topmost = last drawn).
   */
  private hitTestSticker(screenX: number, screenY: number): { layerId: string; sticker: StickerInstance } | null {
    if (!this.stickerLayers) return null;

    // Iterate in reverse (top layer / last sticker = on top)
    for (let li = this.stickerLayers.length - 1; li >= 0; li--) {
      const layer = this.stickerLayers[li];
      if (!layer.visible) continue;

      for (let si = layer.stickers.length - 1; si >= 0; si--) {
        const sticker = layer.stickers[si];
        const img = this.stickerService.getCachedImage(sticker.stickerKey);
        if (!img) continue;

        const screen = this.geoToScreen({ lat: sticker.lat, lng: sticker.lng });
        // Stickers are in world space: world size × zoom = screen pixels
        const size = this.STICKER_BASE_SIZE * sticker.scale * this.scale;
        const aspect = img.naturalWidth / img.naturalHeight;
        const halfW = (aspect >= 1 ? size : size * aspect) / 2 + 5;
        const halfH = (aspect >= 1 ? size / aspect : size) / 2 + 5;

        // Simple AABB check (ignoring sticker rotation for hit-test simplicity)
        const dx = screenX - screen.x;
        const dy = screenY - screen.y;
        if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
          return { layerId: layer.id, sticker };
        }
      }
    }
    return null;
  }

  /** Called externally when the selected sticker's properties were updated */
  updateSelectedSticker(updated: StickerInstance): void {
    if (this.selectedStickerRef) {
      this.selectedStickerRef.sticker = { ...updated };
      this.stickerService.updateSticker(this.selectedStickerRef.layerId, updated, true);
      this.render();
    }
  }

  /** Called externally to remove the selected sticker */
  removeSelectedSticker(): void {
    if (this.selectedStickerRef) {
      this.stickerService.removeSticker(this.selectedStickerRef.layerId, this.selectedStickerRef.sticker.id);
      this.selectedStickerRef = null;
      this.stickerSelectedOnMap.emit(null);
      this.render();
    }
  }

  /** Force re-render (called by container when layers change) */
  refreshStickers(): void {
    this.render();
  }

  // === EDITOR OVERLAY ===

  /**
   * Draws tilemap editor layers on top of the park map canvas.
   * Uses the same geoToScreen() coordinate transform so items align
   * perfectly with the park boundary, sections, and anchor markers.
   */
  private drawEditorOverlay(): void {
    for (const layer of this.editorLayers) {
      if (!layer.visible) continue;
      for (const item of layer.data) {
        this.drawEditorItem(item, layer.opacity);
      }
    }
  }

  private drawEditorItem(item: TilemapLayerData, layerOpacity = 1): void {
    const pos = this.geoToScreen({ lat: item.lat, lng: item.lng });
    const size = 28 * item.scale; // 28px base — visible at default zoom

    this.ctx.save();
    this.ctx.globalAlpha = item.opacity * layerOpacity;

    if (item.type === 'sticker' && item.stickerKey) {
      const img = this.stickerService.getCachedImage(item.stickerKey);
      if (img?.complete && img.naturalWidth > 0) {
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate((item.rotation * Math.PI) / 180);
        this.ctx.drawImage(img, -size / 2, -size / 2, size, size);
        this.ctx.restore();
      } else {
        this.stickerService.loadImage(item.stickerKey).catch(() => {});
        this.ctx.fillStyle = 'rgba(124,131,255,0.35)';
        this.ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      }
    } else if (item.type === 'tile') {
      this.ctx.fillStyle = item.color ?? '#2E7D32';
      this.ctx.save();
      this.ctx.translate(pos.x, pos.y);
      this.ctx.rotate((item.rotation * Math.PI) / 180);
      this.ctx.fillRect(-size / 2, -size / 2, size, size);
      this.ctx.restore();
    } else if (item.type === 'text' && item.text) {
      const fs = item.fontSize ?? 14;
      this.ctx.fillStyle = item.color ?? (this.isDarkTheme ? '#ffffff' : '#111111');
      this.ctx.font = `bold ${fs}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      // Drop shadow for readability on any background
      this.ctx.shadowColor = this.isDarkTheme ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(item.text, pos.x, pos.y);
      this.ctx.shadowBlur = 0;
    } else if (item.type === 'polygon' && item.points && item.points.length >= 3) {
      const pts = item.points.map(p => this.geoToScreen({ lat: p.lat, lng: p.lng }));
      this.ctx.beginPath();
      this.ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
      this.ctx.closePath();
      if (item.fillColor) {
        this.ctx.fillStyle = item.fillColor;
        this.ctx.fill();
      }
      this.ctx.strokeStyle = item.color ?? '#7c83ff';
      this.ctx.lineWidth = item.strokeWidth ?? 2;
      this.ctx.stroke();
    } else if (item.type === 'path' && item.points && item.points.length >= 2) {
      const pts = item.points.map(p => this.geoToScreen({ lat: p.lat, lng: p.lng }));
      this.ctx.beginPath();
      this.ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
      this.ctx.strokeStyle = item.color ?? '#7c83ff';
      this.ctx.lineWidth = item.strokeWidth ?? 2;
      this.ctx.stroke();
    }

    this.ctx.restore();

    // Selection indicator for the currently selected editor item
    if (this.editorSelectedItem?.id === item.id) {
      this.ctx.save();
      this.ctx.strokeStyle = '#7c83ff';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 3]);
      this.ctx.strokeRect(pos.x - size / 2 - 4, pos.y - size / 2 - 4, size + 8, size + 8);
      this.ctx.setLineDash([]);
      // Corner dots
      this.ctx.fillStyle = '#7c83ff';
      for (const [cx, cy] of [
        [pos.x - size / 2 - 4, pos.y - size / 2 - 4],
        [pos.x + size / 2 + 4, pos.y - size / 2 - 4],
        [pos.x - size / 2 - 4, pos.y + size / 2 + 4],
        [pos.x + size / 2 + 4, pos.y + size / 2 + 4],
      ] as [number, number][]) {
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }
  }

  // === EVENTOS ===

  onMouseDown(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ── Tile paint mode: paint on grid cells ──────────────────
    if (this.tilePaintMode && e.button === 0) {
      const cellW = Math.max(1, this.canvasGridCellW);
      const cellH = Math.max(1, this.canvasGridCellH);
      const mp = this.screenToGridLocal(x, y);
      const col = Math.floor(mp.x / cellW);
      const row = Math.floor(mp.y / cellH);

      if (this.tilePaintTool === 'grab') {
        // Grab tool — fall through to normal map panning below
      } else if (this.tilePaintTool === 'rect') {
        this.pushUndo();
        this.rectDragging = true;
        this.rectStartCol = col;
        this.rectStartRow = row;
        this.rectEndCol = col;
        this.rectEndRow = row;
        return;
      } else if (this.tilePaintTool === 'line') {
        this.pushUndo();
        this.lineDragging = true;
        this.lineStartCol = col;
        this.lineStartRow = row;
        this.lineEndCol = col;
        this.lineEndRow = row;
        return;
      } else if (this.tilePaintTool === 'bucket') {
        this.pushUndo();
        this.bucketFill(col, row);
        return;
      } else if (this.tilePaintTool === 'picker') {
        this.paintAtScreenPos(x, y);
        return;
      } else {
        // paint or eraser
        this.pushUndo();
        this.isPainting = true;
        this.paintAtScreenPos(x, y);
        return;
      }
    }

    // In editor mode, only allow map panning (pan tool or middle button)
    if (this.editorMode) {
      if (this.editorActiveTool === 'pan' || e.button === 1) {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        const container = this.canvasRef.nativeElement.parentElement;
        if (container) container.style.cursor = 'grabbing';
      }
      // Other editor tools handle clicks through onClick→editorGeoClick
      return;
    }

    // In sticker edit mode, check rotation handle, then corner handles, then sticker body
    if (this.stickerEditMode) {
      // Rotation handle takes priority
      if (this.selectedStickerRef && this.isNearRotateHandle(x, y)) {
        const center = this.geoToScreen({
          lat: this.selectedStickerRef.sticker.lat,
          lng: this.selectedStickerRef.sticker.lng
        });
        this.isRotatingSticker = true;
        this.rotateDragStartAngle = Math.atan2(y - center.y, x - center.x);
        this.rotateDragStartStkRot = this.selectedStickerRef.sticker.rotation;
        return;
      }

      // Corner handles for scaling
      if (this.selectedStickerRef && this.hitTestCornerHandle(x, y)) {
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        return;
      }

      // Then check sticker body for dragging
      const hit = this.hitTestSticker(x, y);
      if (hit) {
        this.selectedStickerRef = hit;
        this.isDraggingSticker = true;
        this.stickerSelectedOnMap.emit(hit.sticker);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.render();
        return;
      }
    }

    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const container = this.canvasRef.nativeElement.parentElement;
    if (container) {
      container.style.cursor = 'grabbing';
    }
  }

  onMouseMove(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ── Tile paint drag ──────────────────────────────────────
    if (this.isPainting && this.tilePaintMode) {
      this.paintAtScreenPos(x, y);
      return;
    }

    // ── Rect tool drag preview ───────────────────────────────
    if (this.rectDragging && this.tilePaintMode) {
      const cellW = Math.max(1, this.canvasGridCellW);
      const cellH = Math.max(1, this.canvasGridCellH);
      const mp = this.screenToGridLocal(x, y);
      this.rectEndCol = Math.floor(mp.x / cellW);
      this.rectEndRow = Math.floor(mp.y / cellH);
      this.render();
      return;
    }

    // ── Line tool drag preview ───────────────────────────────
    if (this.lineDragging && this.tilePaintMode) {
      const cellW = Math.max(1, this.canvasGridCellW);
      const cellH = Math.max(1, this.canvasGridCellH);
      const mp = this.screenToGridLocal(x, y);
      this.lineEndCol = Math.floor(mp.x / cellW);
      this.lineEndRow = Math.floor(mp.y / cellH);
      this.render();
      return;
    }

    const geo = this.canvasToGeo({ x, y });
    this._cursorLat = geo.lat;
    this._cursorLng = geo.lng;

    // In editor mode, emit geo position for cursor display + item dragging
    if (this.editorMode) {
      this.editorGeoMove.emit({ lat: geo.lat, lng: geo.lng });
      // Still allow map panning so user can navigate
      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.render();
      }
      return;
    }

    // Sticker rotation drag
    if (this.isRotatingSticker && this.selectedStickerRef) {
      const center = this.geoToScreen({
        lat: this.selectedStickerRef.sticker.lat,
        lng: this.selectedStickerRef.sticker.lng
      });
      const currentAngle = Math.atan2(y - center.y, x - center.x);
      const delta = currentAngle - this.rotateDragStartAngle;
      let newRot = this.rotateDragStartStkRot + delta * (180 / Math.PI);
      newRot = ((newRot % 360) + 360) % 360;
      this.selectedStickerRef.sticker = {
        ...this.selectedStickerRef.sticker,
        rotation: Math.round(newRot)
      };
      this.stickerService.updateSticker(
        this.selectedStickerRef.layerId,
        this.selectedStickerRef.sticker
      );
      this.stickerSelectedOnMap.emit(this.selectedStickerRef.sticker);
      this.render();
      return;
    }

    // Sticker corner-handle scaling
    if (this.isScalingSticker && this.selectedStickerRef) {
      const bounds = this.getStickerScreenBounds(this.selectedStickerRef.sticker);
      if (bounds) {
        const currentDist = Math.sqrt((x - bounds.cx) ** 2 + (y - bounds.cy) ** 2);
        const ratio = currentDist / Math.max(this.scaleDragStartDist, 1);
        const newScale = Math.max(0.1, Math.min(5, this.scaleDragStartScale * ratio));
        this.selectedStickerRef.sticker = {
          ...this.selectedStickerRef.sticker,
          scale: Math.round(newScale * 100) / 100
        };
        this.stickerService.updateSticker(
          this.selectedStickerRef.layerId,
          this.selectedStickerRef.sticker
        );
        this.stickerSelectedOnMap.emit(this.selectedStickerRef.sticker);
        this.render();
      }
      return;
    }

    // Sticker dragging
    if (this.isDraggingSticker && this.selectedStickerRef) {
      const newGeo = this.canvasToGeo({ x, y });
      this.selectedStickerRef.sticker = {
        ...this.selectedStickerRef.sticker,
        lat: newGeo.lat,
        lng: newGeo.lng
      };
      this.stickerService.updateSticker(
        this.selectedStickerRef.layerId,
        this.selectedStickerRef.sticker
      );
      this.stickerSelectedOnMap.emit(this.selectedStickerRef.sticker);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.render();
      return;
    }

    // Check if hovering over a marker or sticker to change cursor
    if (!this.isDragging) {
      // Throttle: skip expensive hit-test if cursor barely moved
      const movedEnough =
        Math.abs(x - this.lastCursorX) >= this.CURSOR_MOVE_THRESHOLD ||
        Math.abs(y - this.lastCursorY) >= this.CURSOR_MOVE_THRESHOLD;

      if (!movedEnough) return; // no cursor update needed
      this.lastCursorX = x;
      this.lastCursorY = y;

      let overInteractive = false;
      let cursorType = 'grab';

      // Check rotation handle of selected sticker
      if (this.stickerEditMode && this.selectedStickerRef) {
        if (this.isNearRotateHandle(x, y)) {
          overInteractive = true;
          cursorType = 'grab';
        }
      }

      // Check corner handles of selected sticker (rotation-aware)
      if (!overInteractive && this.stickerEditMode && this.selectedStickerRef) {
        if (this.isNearCornerHandle(x, y)) {
          overInteractive = true;
          cursorType = 'nwse-resize';
        }
      }

      // Check stickers in edit mode
      if (!overInteractive && this.stickerEditMode) {
        if (this.hitTestSticker(x, y)) {
          overInteractive = true;
          cursorType = 'move';
        }
      }

      // Check markers
      if (!overInteractive) {
        for (const marker of this.markers) {
          const mp = this.geoToScreen(marker.geo);
          const dx = x - mp.x;
          const dy = y - mp.y;
          if (Math.sqrt(dx * dx + dy * dy) < (this.markerRadius || this.MARKER_RADIUS) + 5) {
            overInteractive = true;
            cursorType = 'pointer';
            break;
          }
        }
      }

      const container = this.canvasRef.nativeElement.parentElement;
      if (container) {
        if (this.tilePaintMode) {
          // Tool-specific cursors for tile painting
          const toolCursors: Record<string, string> = {
            paint: 'crosshair', eraser: 'not-allowed', bucket: 'cell',
            rect: 'crosshair', line: 'crosshair', picker: 'copy', grab: 'grab'
          };
          container.style.cursor = toolCursors[this.tilePaintTool] ?? 'crosshair';
        } else if (this.stickerEditMode && this.placingStickerKey) {
          container.style.cursor = 'crosshair';
        } else if (overInteractive) {
          container.style.cursor = cursorType;
        } else {
          container.style.cursor = 'grab';
        }
      }
    }

    if (this.isDragging) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (this.activeMovableLayer === 'canvas') {
        this.offsetX += dx;
        this.offsetY += dy;
      } else if (this.activeMovableLayer === 'grid') {
        // Grid has its own rotation — use gridRad for correct delta conversion
        const gridRad = this.canvasGridRotation * Math.PI / 180;
        const c = Math.cos(-gridRad);
        const sn = Math.sin(-gridRad);
        const lo = this.layerOffsets.grid;
        lo.x += (dx * c - dy * sn) / this.scale;
        lo.y += (dx * sn + dy * c) / this.scale;
      } else {
        // Other layers use the map rotation
        const c = Math.cos(-this.rotation);
        const sn = Math.sin(-this.rotation);
        const mdx = (dx * c - dy * sn) / this.scale;
        const mdy = (dx * sn + dy * c) / this.scale;
        const lo = this.layerOffsets[this.activeMovableLayer];
        lo.x += mdx;
        lo.y += mdy;
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.render();
    }
  }

  onMouseUp(): void {
    // Tile painting end
    if (this.isPainting) {
      this.isPainting = false;
      return;
    }
    // Rectangle fill end
    if (this.rectDragging) {
      this.rectDragging = false;
      this.fillRect(
        Math.min(this.rectStartCol, this.rectEndCol),
        Math.min(this.rectStartRow, this.rectEndRow),
        Math.max(this.rectStartCol, this.rectEndCol),
        Math.max(this.rectStartRow, this.rectEndRow),
      );
      this.rectStartCol = -1;
      this.rectStartRow = -1;
      this.rectEndCol = -1;
      this.rectEndRow = -1;
      this.render();
      return;
    }
    // Line fill end
    if (this.lineDragging) {
      this.lineDragging = false;
      this.fillLine(this.lineStartCol, this.lineStartRow, this.lineEndCol, this.lineEndRow);
      this.lineStartCol = -1;
      this.lineStartRow = -1;
      this.lineEndCol = -1;
      this.lineEndRow = -1;
      this.render();
      return;
    }
    // Editor mode: notify parent + reset map pan
    if (this.editorMode) {
      this.editorGeoMouseUp.emit();
      if (this.isDragging) {
        this.isDragging = false;
        const container = this.canvasRef.nativeElement.parentElement;
        if (container) container.style.cursor = 'grab';
        this.saveState();
      }
      return;
    }
    if (this.isRotatingSticker) {
      this.isRotatingSticker = false;
      if (this.selectedStickerRef) {
        this.stickerService.updateSticker(
          this.selectedStickerRef.layerId,
          this.selectedStickerRef.sticker,
          true
        );
        this.stickerMoved.emit(this.selectedStickerRef.sticker);
      }
      return;
    }
    if (this.isScalingSticker) {
      this.isScalingSticker = false;
      if (this.selectedStickerRef) {
        // Persist final position with undo snapshot
        this.stickerService.updateSticker(
          this.selectedStickerRef.layerId,
          this.selectedStickerRef.sticker,
          true
        );
        this.stickerMoved.emit(this.selectedStickerRef.sticker);
      }
      return;
    }
    if (this.isDraggingSticker) {
      this.isDraggingSticker = false;
      if (this.selectedStickerRef) {
        // Persist final position with undo snapshot
        this.stickerService.updateSticker(
          this.selectedStickerRef.layerId,
          this.selectedStickerRef.sticker,
          true
        );
        this.stickerMoved.emit(this.selectedStickerRef.sticker);
      }
      return;
    }
    if (this.isDragging) {
      this.isDragging = false;
      const container = this.canvasRef.nativeElement.parentElement;
      if (container) {
        container.style.cursor = 'grab';
      }
      this.saveState();
    }
  }

  onMouseLeave(): void {
    this.isDragging = false;
    this.isDraggingSticker = false;
    this.isScalingSticker = false;
    this.isRotatingSticker = false;
    this.stopContinuousRotation();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvasRef.nativeElement.width / dpr;
    const h = this.canvasRef.nativeElement.height / dpr;

    // Store zoom anchor: cursor position relative to viewport center.
    // The animation loop will use this each frame to keep the world-point
    // under the cursor fixed while scale interpolates.
    this._zoomAnchorX = mouseX - w / 2;
    this._zoomAnchorY = mouseY - h / 2;
    this._hasZoomAnchor = true;

    // Symmetric zoom factor (1/0.9 ≈ 1.111, ensures zoom-in/out are reversible)
    const factor = e.deltaY > 0 ? 0.9 : (1 / 0.9);
    this.targetScale = Math.max(0.3, Math.min(15, this.targetScale * factor));
  }

  onClick(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ── Editor mode: route click to tilemap editor ──────────
    if (this.editorMode) {
      const geo = this.canvasToGeo({ x, y });
      this.editorGeoClick.emit({ lat: geo.lat, lng: geo.lng });
      return;
    }

    // ── Sticker edit mode: select or deselect ──────────────
    if (this.stickerEditMode) {
      // Try to select a sticker (not on corner handle)
      const hit = this.hitTestSticker(x, y);
      if (hit) {
        this.selectedStickerRef = hit;
        this.stickerSelectedOnMap.emit(hit.sticker);
        this.render();
        return;
      } else {
        // Deselect
        this.selectedStickerRef = null;
        this.stickerSelectedOnMap.emit(null);
        this.render();
      }
    }

    // ── Normal mode: copy coords + check anchor click ───────
    if (this.coordPickerMode) {
      const geo = this.canvasToGeo({ x, y });
      const coords = `${geo.lat.toFixed(8)}, ${geo.lng.toFixed(8)}`;
      navigator.clipboard.writeText(coords).then(() => {
        this.lastCopiedCoords = coords;
        this.showCopyToast = true;
        setTimeout(() => this.showCopyToast = false, 2500);
      });
      return; // coord picker mode — no other click actions
    }

    const geo = this.canvasToGeo({ x, y });
    const coords = `${geo.lat.toFixed(8)}, ${geo.lng.toFixed(8)}`;

    navigator.clipboard.writeText(coords).then(() => {
      this.lastCopiedCoords = coords;
      this.showCopyToast = true;
      setTimeout(() => this.showCopyToast = false, 2500);
    });

    for (const marker of this.markers) {
      const mp = this.geoToScreen(marker.geo);
      const dx = x - mp.x;
      const dy = y - mp.y;
      if (Math.sqrt(dx*dx + dy*dy) < (this.markerRadius || this.MARKER_RADIUS) + 5) {
        this.anchorClick.emit(marker.id);
        break;
      }
    }
  }

  /** Allow drag over the map canvas */
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  /** Handle sticker dropped from the panel onto the map */
  onMapDrop(e: DragEvent): void {
    e.preventDefault();
    const key = e.dataTransfer?.getData('text/plain');
    if (!key) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const geo = this.canvasToGeo({ x, y });
    this.stickerDroppedOnMap.emit({ key, lat: geo.lat, lng: geo.lng });
  }

  /** Global keyboard handler for sticker editing shortcuts */
  /** Set a single map option and re-render */
  setMapOption(option: 'showSections' | 'showLabels' | 'showCanvasGrid' | 'showTilemap' | 'showBoundary' | 'showMarkers', value: boolean): void {
    this.mapOptions[option] = value;
    this.onOptionChange();
    this.emitViewInfo();
  }

  /** Emit current view state to external listeners */
  private emitViewInfo(): void {
    if (!this.isBrowser || !this.canvasRef?.nativeElement) return;
    const canvasEl = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasEl.width / dpr;
    const h = canvasEl.height / dpr;
    const center = this.canvasToGeo({ x: w / 2, y: h / 2 });
    this.viewInfo.emit({
      lat: center.lat,
      lng: center.lng,
      zoom: this.scale,
      rotDeg: this.rotationDeg,
      showSections: this.mapOptions.showSections,
      showLabels: this.mapOptions.showLabels,
      showCanvasGrid: this.mapOptions.showCanvasGrid,
      showBoundary: this.mapOptions.showBoundary,
      showMarkers: this.mapOptions.showMarkers,
      canvasGridCellW: this.canvasGridCellW,
      canvasGridCellH: this.canvasGridCellH,
      canvasGridOpacity: this.canvasGridOpacity,
      canvasGridColor: this.canvasGridColor,
      canvasGridStyle: this.canvasGridStyle,
      canvasGridRotation: this.canvasGridRotation,
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // ── Global map shortcuts (work regardless of edit mode) ─────
    if (e.ctrlKey) {
      switch (e.key) {
        case '=': case '+':  // Ctrl++ zoom in
          e.preventDefault(); this.zoomIn(); return;
        case '-': case '_':  // Ctrl+- zoom out
          e.preventDefault(); this.zoomOut(); return;
        case 'ArrowLeft':    // Ctrl+← rotate left
          e.preventDefault(); this.rotateOnce('left'); return;
        case 'ArrowRight':   // Ctrl+→ rotate right
          e.preventDefault(); this.rotateOnce('right'); return;
        case 'r': case 'R':  // Ctrl+R reset view
          e.preventDefault(); this.resetView(); this.emitViewInfo(); return;
        case 'l': case 'L':  // Ctrl+L toggle labels
          e.preventDefault(); this.setMapOption('showLabels', !this.mapOptions.showLabels); return;
        case 'S':            // Ctrl+Shift+S toggle sections
          if (e.shiftKey) { e.preventDefault(); this.setMapOption('showSections', !this.mapOptions.showSections); return; }
          break;
        case 'd': case 'D':  // Ctrl+D toggle canvas grid
          if (!e.shiftKey) { e.preventDefault(); this.setMapOption('showCanvasGrid', !this.mapOptions.showCanvasGrid); return; }
          break;
        case 't': case 'T':  // Ctrl+T (unused now)
          break;
      }
    }

    // ── Tile paint undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) ──
    if (this.tilePaintMode && e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    if (this.tilePaintMode && ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      this.redo();
      return;
    }

    // ── Tile paint tool shortcuts (single key, no modifier) ──
    if (this.tilePaintMode && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const toolMap: Record<string, string> = { b: 'paint', r: 'rect', l: 'line', g: 'bucket', e: 'eraser', i: 'picker', h: 'grab' };
      const tool = toolMap[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        this.tilePaintTool = tool as any;
        this.tilePaintToolChange.emit(this.tilePaintTool);
        return;
      }
    }

    // ── Sticker edit-mode only shortcuts ────────────────────────
    if (!this.stickerEditMode) return;

    // Ctrl+Z — Undo
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      this.stickerService.undo();
      this.selectedStickerRef = null;
      this.stickerSelectedOnMap.emit(null);
      this.render();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z — Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      this.stickerService.redo();
      this.selectedStickerRef = null;
      this.stickerSelectedOnMap.emit(null);
      this.render();
      return;
    }

    // Ctrl+D — Duplicate selected sticker
    if (e.ctrlKey && (e.key === 'd' || e.key === 'D') && this.selectedStickerRef) {
      e.preventDefault();
      const src = this.selectedStickerRef.sticker;
      const activeLayer = this.stickerService.getActiveLayer();
      if (activeLayer) {
        const dup = this.stickerService.addSticker(activeLayer.id, src.stickerKey, src.lat + 0.00005, src.lng + 0.00005);
        this.stickerService.updateSticker(activeLayer.id, { ...dup, scale: src.scale, rotation: src.rotation, opacity: src.opacity });
        this.render();
      }
      return;
    }

    // Ctrl+C — Copy selected sticker coords to clipboard
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && this.selectedStickerRef) {
      const s = this.selectedStickerRef.sticker;
      const text = `${s.lat.toFixed(8)}, ${s.lng.toFixed(8)}`;
      navigator.clipboard?.writeText(text);
      return;
    }

    // Arrow keys — nudge selected sticker
    if (this.selectedStickerRef && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const nudge = e.shiftKey ? 0.0001 : 0.00002;
      const s = this.selectedStickerRef.sticker;
      const updated: typeof s = { ...s };
      if (e.key === 'ArrowUp')    updated.lat = s.lat + nudge;
      if (e.key === 'ArrowDown')  updated.lat = s.lat - nudge;
      if (e.key === 'ArrowLeft')  updated.lng = s.lng - nudge;
      if (e.key === 'ArrowRight') updated.lng = s.lng + nudge;
      const layer = this.stickerService.getActiveLayer();
      if (layer) this.stickerService.updateSticker(layer.id, updated);
      this.selectedStickerRef.sticker = updated;
      this.stickerSelectedOnMap.emit(updated);
      this.render();
      return;
    }

    // Delete / Backspace — remove selected sticker
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedStickerRef) {
      e.preventDefault();
      this.removeSelectedSticker();
      return;
    }

    // Escape — deselect
    if (e.key === 'Escape') {
      this.selectedStickerRef = null;
      this.stickerSelectedOnMap.emit(null);
      this.render();
    }
  }

  // === CONTROLES ===

  zoomIn(): void {
    this.targetScale = Math.min(15, this.targetScale * 1.4);
  }

  zoomOut(): void {
    this.targetScale = Math.max(0.3, this.targetScale / 1.4);
  }

  rotateOnce(direction: 'left' | 'right'): void {
    if (this.isRotating) return; // Evitar si ya estamos en rotación continua

    const step = Math.PI / 48; // 3.75° por click
    if (direction === 'left') {
      this.targetRotation -= step;
    } else {
      this.targetRotation += step;
    }
  }

  startContinuousRotation(direction: 'left' | 'right'): void {
    // Esperar un momento antes de empezar rotación continua
    this.rotationHoldTimer = setTimeout(() => {
      this.isRotating = true;

      this.rotationInterval = setInterval(() => {
        if (direction === 'left') {
          this.rotation -= this.ROTATION_STEP;
          this.targetRotation = this.rotation;
        } else {
          this.rotation += this.ROTATION_STEP;
          this.targetRotation = this.rotation;
        }
      }, 16); // ~60fps
    }, this.HOLD_DELAY);
  }

  stopContinuousRotation(): void {
    if (this.rotationHoldTimer) {
      clearTimeout(this.rotationHoldTimer);
      this.rotationHoldTimer = null;
    }
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
    if (this.isRotating) {
      this.isRotating = false;
      this.saveState();
    }
  }

  resetView(): void {
    this.targetScale = 1.2;
    this.targetRotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this._hasZoomAnchor = false;
    this.saveState();
  }

  /** Recentra el mapa en el centroide del contorno del parque sin cambiar zoom. */
  centerMap(): void {
    if (!this.isBrowser || !this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Compute centroid of park boundary
    let sumLat = 0, sumLng = 0;
    for (const p of PARK_BOUNDARY) { sumLat += p.lat; sumLng += p.lng; }
    const centroid: GeoPoint = { lat: sumLat / PARK_BOUNDARY.length, lng: sumLng / PARK_BOUNDARY.length };

    // Convert centroid to base canvas coords (before transform)
    const base = this.geoToCanvas(centroid);
    const cx = w / 2;
    const cy = h / 2;

    // Apply current scale + rotation to get the offset needed
    let dx = base.x - cx;
    let dy = base.y - cy;
    dx *= this.scale;
    dy *= this.scale;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = cos * dx - sin * dy;
    const ry = sin * dx + cos * dy;

    // offsetX/Y moves screen — to center the centroid we negate the displacement
    this.offsetX = -rx;
    this.offsetY = -ry;
    this._hasZoomAnchor = false;
    this.saveState();
    this.render();
    this.emitViewInfo();
  }

  /** Toggle GPS coordinate picker mode. */
  toggleCoordPicker(): void {
    this.coordPickerMode = !this.coordPickerMode;
  }

  // === MAP STATE CAPTURE / RESTORE (for layer config system) ===

  /** Capture current map view state as a serializable object */
  getMapViewState(): { scale: number; rotation: number; offsetX: number; offsetY: number; showSections: boolean; showLabels: boolean; showCanvasGrid: boolean; canvasGridCellW: number; canvasGridCellH: number; canvasGridOpacity: number } {
    return {
      scale: this.scale,
      rotation: this.rotation,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      showSections: this.mapOptions.showSections,
      showLabels: this.mapOptions.showLabels,
      showCanvasGrid: this.mapOptions.showCanvasGrid,
      canvasGridCellW: this.canvasGridCellW,
      canvasGridCellH: this.canvasGridCellH,
      canvasGridOpacity: this.canvasGridOpacity
    };
  }

  /** Restore map view state from a saved configuration */
  setMapViewState(state: { scale: number; rotation: number; offsetX: number; offsetY: number; showSections: boolean; showLabels: boolean; showCanvasGrid?: boolean; canvasGridCellW?: number; canvasGridCellH?: number; canvasGridOpacity?: number }): void {
    this.scale = state.scale;
    this.targetScale = state.scale;
    this.rotation = state.rotation;
    this.targetRotation = state.rotation;
    this.offsetX = state.offsetX;
    this.offsetY = state.offsetY;
    this.mapOptions.showSections = state.showSections;
    this.mapOptions.showLabels = state.showLabels;
    this.mapOptions.showCanvasGrid = state.showCanvasGrid ?? false;
    if (state.canvasGridCellW) this.canvasGridCellW = state.canvasGridCellW;
    if (state.canvasGridCellH) this.canvasGridCellH = state.canvasGridCellH;
    if (state.canvasGridOpacity != null) this.canvasGridOpacity = state.canvasGridOpacity;
    this.saveState();
    this.render();
    this.emitViewInfo();
  }
}
