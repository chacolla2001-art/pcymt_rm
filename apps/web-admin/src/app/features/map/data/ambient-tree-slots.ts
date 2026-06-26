/** Posiciones fijas de árboles decorativos (lat/lng dentro de cada sección del parque). */
export interface AmbientTreeSlot {
  lat: number;
  lng: number;
  /** Índice de sección (0=Altas, 1=Medias, 2=Bajas). */
  section: number;
  variant: 0 | 1 | 2;
  seed: number;
  scale: number;
}

/** Generados dentro del polígono de cada sección (no solo el bbox del parque). */
export const AMBIENT_TREE_SLOTS: AmbientTreeSlot[] = [
  { lat: -16.48822279, lng: -68.14600518, section: 0, variant: 2, seed: 4.75, scale: 1.138 },
  { lat: -16.48702826, lng: -68.14591436, section: 0, variant: 2, seed: 11.26, scale: 0.891 },
  { lat: -16.48804369, lng: -68.14604306, section: 0, variant: 1, seed: 28.62, scale: 1.18 },
  { lat: -16.48819447, lng: -68.14649306, section: 0, variant: 0, seed: 32.96, scale: 1.069 },
  { lat: -16.48810112, lng: -68.14576065, section: 0, variant: 2, seed: 37.3, scale: 0.885 },
  { lat: -16.48673272, lng: -68.14592364, section: 0, variant: 1, seed: 41.64, scale: 1.095 },
  { lat: -16.48771081, lng: -68.14622691, section: 0, variant: 2, seed: 50.32, scale: 1.178 },
  { lat: -16.48800473, lng: -68.1461106, section: 0, variant: 1, seed: 54.66, scale: 1.208 },
  { lat: -16.4874639, lng: -68.14626919, section: 0, variant: 2, seed: 56.83, scale: 1.188 },
  { lat: -16.48831249, lng: -68.14617144, section: 0, variant: 2, seed: 63.34, scale: 0.983 },
  { lat: -16.49011044, lng: -68.14558842, section: 1, variant: 0, seed: 72.02, scale: 1.173 },
  { lat: -16.48954292, lng: -68.14551637, section: 1, variant: 1, seed: 74.19, scale: 1.08 },
  { lat: -16.49011318, lng: -68.14549336, section: 1, variant: 0, seed: 78.53, scale: 0.909 },
  { lat: -16.48842893, lng: -68.14615452, section: 1, variant: 1, seed: 80.7, scale: 0.864 },
  { lat: -16.48861154, lng: -68.1456705, section: 1, variant: 1, seed: 87.21, scale: 0.971 },
  { lat: -16.48918207, lng: -68.14552846, section: 1, variant: 0, seed: 91.55, scale: 0.953 },
  { lat: -16.49007822, lng: -68.14523871, section: 1, variant: 0, seed: 111.08, scale: 1.106 },
  { lat: -16.48961432, lng: -68.14533963, section: 1, variant: 0, seed: 117.59, scale: 1.052 },
  { lat: -16.49005652, lng: -68.14542795, section: 1, variant: 0, seed: 124.1, scale: 1.197 },
  { lat: -16.48939389, lng: -68.14512466, section: 1, variant: 1, seed: 126.27, scale: 1.055 },
  { lat: -16.49039611, lng: -68.14533905, section: 2, variant: 0, seed: 130.61, scale: 1.126 },
  { lat: -16.49067518, lng: -68.14503949, section: 2, variant: 2, seed: 134.95, scale: 1.151 },
  { lat: -16.49049368, lng: -68.14506696, section: 2, variant: 1, seed: 139.29, scale: 1.004 },
  { lat: -16.49080794, lng: -68.14524387, section: 2, variant: 2, seed: 141.46, scale: 1.132 },
  { lat: -16.49070896, lng: -68.14520687, section: 2, variant: 0, seed: 143.63, scale: 0.903 },
  { lat: -16.49036277, lng: -68.14548612, section: 2, variant: 2, seed: 154.48, scale: 1.095 },
  { lat: -16.49065775, lng: -68.14496965, section: 2, variant: 0, seed: 156.65, scale: 0.974 },
  { lat: -16.49037134, lng: -68.1453246, section: 2, variant: 1, seed: 158.82, scale: 1.028 },
  { lat: -16.49034909, lng: -68.14470357, section: 2, variant: 1, seed: 171.84, scale: 1.21 },
  { lat: -16.49040532, lng: -68.14535393, section: 2, variant: 2, seed: 174.01, scale: 0.89 },
];
