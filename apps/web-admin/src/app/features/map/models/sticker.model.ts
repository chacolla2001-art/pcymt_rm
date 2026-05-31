/**
 * Sticker Layer System — Data Models
 *
 * Allows users to create visual layers on the park map,
 * placing sticker images at specific geo positions with
 * control over size, rotation, and opacity.
 */

/** A sticker image available in the catalog */
export interface StickerDefinition {
  key: string;        // filename without extension (e.g. 'anfiteatro')
  name: string;       // human-readable display name
  imagePath: string;  // relative asset path
  category?: string;  // optional grouping (tileset, object, character)
}

/** A single sticker instance placed on the map */
export interface StickerInstance {
  id: string;
  stickerKey: string;       // references StickerDefinition.key
  lat: number;              // WGS84 latitude
  lng: number;              // WGS84 longitude
  scale: number;            // 0.1 – 5.0  (1 = original)
  rotation: number;         // degrees 0-360
  opacity: number;          // 0.0 – 1.0
}

/** A named collection of sticker instances */
export interface StickerLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;          // 0.0 – 1.0  layer-level opacity for all stickers
  stickers: StickerInstance[];
}

/** Complete sticker catalog */
export const STICKER_CATALOG: StickerDefinition[] = [
  // ── Elementos del parque (001–032) ─────────────────────────
  { key: '001', name: 'Elemento 01', imagePath: 'assets/map-stickers/001.svg' },
  { key: '002', name: 'Elemento 02', imagePath: 'assets/map-stickers/002.svg' },
  { key: '003', name: 'Elemento 03', imagePath: 'assets/map-stickers/003.svg' },
  { key: '004', name: 'Elemento 04', imagePath: 'assets/map-stickers/004.svg' },
  { key: '005', name: 'Elemento 05', imagePath: 'assets/map-stickers/005.svg' },
  { key: '006', name: 'Elemento 06', imagePath: 'assets/map-stickers/006.svg' },
  { key: '007', name: 'Elemento 07', imagePath: 'assets/map-stickers/007.svg' },
  { key: '008', name: 'Elemento 08', imagePath: 'assets/map-stickers/008.svg' },
  { key: '009', name: 'Elemento 09', imagePath: 'assets/map-stickers/009.svg' },
  { key: '010', name: 'Elemento 10', imagePath: 'assets/map-stickers/010.svg' },
  { key: '011', name: 'Elemento 11', imagePath: 'assets/map-stickers/011.svg' },
  { key: '012', name: 'Elemento 12', imagePath: 'assets/map-stickers/012.svg' },
  { key: '013', name: 'Elemento 13', imagePath: 'assets/map-stickers/013.svg' },
  { key: '014', name: 'Elemento 14', imagePath: 'assets/map-stickers/014.svg' },
  { key: '015', name: 'Elemento 15', imagePath: 'assets/map-stickers/015.svg' },
  { key: '016', name: 'Elemento 16', imagePath: 'assets/map-stickers/016.svg' },
  { key: '017', name: 'Elemento 17', imagePath: 'assets/map-stickers/017.svg' },
  { key: '018', name: 'Elemento 18', imagePath: 'assets/map-stickers/018.svg' },
  { key: '019', name: 'Elemento 19', imagePath: 'assets/map-stickers/019.svg' },
  { key: '020', name: 'Elemento 20', imagePath: 'assets/map-stickers/020.svg' },
  { key: '021', name: 'Elemento 21', imagePath: 'assets/map-stickers/021.svg' },
  { key: '022', name: 'Elemento 22', imagePath: 'assets/map-stickers/022.svg' },
  { key: '023', name: 'Elemento 23', imagePath: 'assets/map-stickers/023.svg' },
  { key: '024', name: 'Elemento 24', imagePath: 'assets/map-stickers/024.svg' },
  { key: '025', name: 'Elemento 25', imagePath: 'assets/map-stickers/025.svg' },
  { key: '026', name: 'Elemento 26', imagePath: 'assets/map-stickers/026.svg' },
  { key: '027', name: 'Elemento 27', imagePath: 'assets/map-stickers/027.svg' },
  { key: '028', name: 'Elemento 28', imagePath: 'assets/map-stickers/028.svg' },
  { key: '029', name: 'Elemento 29', imagePath: 'assets/map-stickers/029.svg' },
  { key: '030', name: 'Elemento 30', imagePath: 'assets/map-stickers/030.svg' },
  { key: '031', name: 'Elemento 31', imagePath: 'assets/map-stickers/031.svg' },
  { key: '032', name: 'Elemento 32', imagePath: 'assets/map-stickers/032.svg' },
  // ── Árboles ────────────────────────────────────────────────
  { key: 'tree-1', name: 'Árbol 1', imagePath: 'assets/map-stickers/tree-1.svg' },
  { key: 'tree-2', name: 'Árbol 2', imagePath: 'assets/map-stickers/tree-2.svg' },
  { key: 'tree-3', name: 'Árbol 3', imagePath: 'assets/map-stickers/tree-3.svg' },
  { key: 'tree-4', name: 'Árbol 4', imagePath: 'assets/map-stickers/tree-4.svg' },
  { key: 'tree-5', name: 'Árbol 5', imagePath: 'assets/map-stickers/tree-5.svg' },
  { key: 'tree-6', name: 'Árbol 6', imagePath: 'assets/map-stickers/tree-6.svg' },
  // ── Otros ──────────────────────────────────────────────────
  { key: 'zampona', name: 'Zampoña',  imagePath: 'assets/map-stickers/zampona.png' },
];
