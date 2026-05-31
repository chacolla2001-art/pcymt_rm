/** Configuración pública expuesta por GET /api/config */
export interface PublicAppConfig {
  google: {
    webClientId: string | null;
    androidClientId: string | null;
    mapsApiKey: string | null;
  };
  arcore: {
    cloudAnchorTtlDays: number;
  };
  storage: {
    enabled: boolean;
    publicBaseUrl: string | null;
    bucket: string | null;
  };
  features: {
    googleAuthEnabled: boolean;
    mapsEnabled: boolean;
    supabaseStorageEnabled?: boolean;
  };
}
