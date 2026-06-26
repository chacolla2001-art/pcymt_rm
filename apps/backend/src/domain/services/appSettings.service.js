/**
 * Persisted key/value settings (replaces runtime-config.json on serverless).
 */
class AppSettingsService {
  constructor(appSettingModel) {
    this.model = appSettingModel;
  }

  async getValue(key) {
    const row = await this.model.findByPk(key);
    return row?.value ?? null;
  }

  async getNumber(key, fallback) {
    const value = await this.getValue(key);
    if (value == null) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  async setValue(key, value) {
    const [row] = await this.model.upsert({
      key,
      value,
      updated_at: new Date(),
    });
    return row;
  }
}

module.exports = AppSettingsService;
