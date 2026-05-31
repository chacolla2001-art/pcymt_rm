// Infrastructure - Database & External Services
const {
  User,
  VirtualAsset,
  Location,
  Interaction,
  Session,
  MapConfiguration,
} = require('../infrastructure/database/models');
const { EmailService, GoogleAuthService, FileUploadService, SupabaseStorageService } = require('../infrastructure/external');
const logger = require('../shared/utils/logger.util');

// Domain - Repositories
const {
  UserRepository,
  VirtualAssetRepository,
  LocationRepository,
  InteractionRepository,
  SessionRepository,
  MapConfigurationRepository,
} = require('../domain/repositories');

// Domain - Services
const {
  UserService,
  AuthService,
  VirtualAssetService,
  AnchorPointService,
  UserInteractionService,
  UserSessionService,
  AnalyticsService,
  MapConfigurationService,
  MapTileService,
} = require('../domain/services');

// API - Controllers
const {
  UserController,
  AuthController,
  VirtualAssetController,
  AnchorPointController,
  UserInteractionController,
  UserSessionController,
  AnalyticsController,
  ConfigController,
  FileController,
  MapConfigurationController,
  MapTileController,
} = require('../api/controllers');

// API - Middlewares
const { createAuthMiddleware } = require('../api/middlewares');

// Shared - Utils
const { EncryptionUtil, JwtUtil } = require('../shared/utils');

// Config
const env = require('./env');

/**
 * Dependency Injection Container
 * Creates and wires all dependencies
 */
class Container {
  constructor() {
    this._instances = {};
    this._initialized = false;
  }

  /**
   * Initialize all dependencies
   */
  init() {
    if (this._initialized) {
      return this;
    }

    // Utils (Singletons)
    this._instances.encryptionUtil = new EncryptionUtil();
    this._instances.jwtUtil = new JwtUtil();

    // External Services
    this._instances.emailService = new EmailService();
    this._instances.googleAuthService = new GoogleAuthService();
    this._instances.fileUploadService = new FileUploadService(env.uploadDir);
    this._instances.supabaseStorageService = new SupabaseStorageService({
      url: env.supabaseUrl,
      bucket: env.supabaseStorageBucket,
      serviceRoleKey: env.supabaseServiceRoleKey,
    });

    // Repositories
    this._instances.userRepository = new UserRepository(User);
    this._instances.virtualAssetRepository = new VirtualAssetRepository(VirtualAsset);
    this._instances.locationRepository = new LocationRepository(Location);
    this._instances.interactionRepository = new InteractionRepository(Interaction);
    this._instances.sessionRepository = new SessionRepository(Session);
    this._instances.mapConfigurationRepository = new MapConfigurationRepository(MapConfiguration);

    // Services
    this._instances.userService = new UserService(
      this._instances.userRepository,
      this._instances.encryptionUtil,
      this._instances.emailService,
      this._instances.sessionRepository,
      this._instances.interactionRepository,
    );

    this._instances.authService = new AuthService(
      this._instances.userRepository,
      this._instances.sessionRepository,
      this._instances.encryptionUtil,
      this._instances.jwtUtil,
    );

    this._instances.virtualAssetService = new VirtualAssetService(
      this._instances.virtualAssetRepository,
    );

    this._instances.anchorPointService = new AnchorPointService(
      this._instances.locationRepository,
    );

    this._instances.userInteractionService = new UserInteractionService(
      this._instances.interactionRepository,
    );

    this._instances.userSessionService = new UserSessionService(
      this._instances.sessionRepository,
    );

    this._instances.analyticsService = new AnalyticsService(
      this._instances.userRepository,
      this._instances.virtualAssetRepository,
      this._instances.locationRepository,
      this._instances.interactionRepository,
    );

    this._instances.mapConfigurationService = new MapConfigurationService(
      this._instances.mapConfigurationRepository,
    );

    this._instances.mapTileService = new MapTileService(
      this._instances.locationRepository,
      this._instances.virtualAssetRepository,
      env.uploadDir,
    );

    // Controllers
    this._instances.userController = new UserController(
      this._instances.userService,
      this._instances.fileUploadService,
      this._instances.authService,
    );

    this._instances.authController = new AuthController(
      this._instances.authService,
      this._instances.userService,
      this._instances.googleAuthService,
      this._instances.emailService,
    );

    this._instances.virtualAssetController = new VirtualAssetController(
      this._instances.virtualAssetService,
      this._instances.fileUploadService,
    );

    this._instances.anchorPointController = new AnchorPointController(
      this._instances.anchorPointService,
    );

    this._instances.userInteractionController = new UserInteractionController(
      this._instances.userInteractionService,
    );

    this._instances.userSessionController = new UserSessionController(
      this._instances.userSessionService,
    );

    this._instances.analyticsController = new AnalyticsController(
      this._instances.analyticsService,
    );

    this._instances.configController = new ConfigController();

    this._instances.fileController = new FileController(
      env.uploadDir,
      this._instances.supabaseStorageService,
    );

    this._instances.mapConfigurationController = new MapConfigurationController(
      this._instances.mapConfigurationService,
    );

    this._instances.mapTileController = new MapTileController(
      this._instances.mapTileService,
    );

    // Middlewares
    this._instances.authMiddleware = createAuthMiddleware(this._instances.jwtUtil);

    // Upload middleware wrapper
    this._instances.uploadMiddleware = {
      single: (fieldName) => this._instances.fileUploadService.single(fieldName),
      fields: (fields) => this._instances.fileUploadService.fields(fields),
      array: (fieldName, maxCount) => this._instances.fileUploadService.array(fieldName, maxCount),
    };

    this._initialized = true;
    logger.info('Dependency container initialized');

    return this;
  }

  /**
   * Get all instances for route creation
   */
  getRouteContainer() {
    if (!this._initialized) {
      this.init();
    }

    return {
      userController: this._instances.userController,
      authController: this._instances.authController,
      virtualAssetController: this._instances.virtualAssetController,
      anchorPointController: this._instances.anchorPointController,
      userInteractionController: this._instances.userInteractionController,
      userSessionController: this._instances.userSessionController,
      analyticsController: this._instances.analyticsController,
      configController: this._instances.configController,
      fileController: this._instances.fileController,
      mapConfigurationController: this._instances.mapConfigurationController,
      mapTileController: this._instances.mapTileController,
      authMiddleware: this._instances.authMiddleware,
      uploadMiddleware: this._instances.uploadMiddleware,
    };
  }

  /**
   * Get a specific service
   */
  get(name) {
    if (!this._initialized) {
      this.init();
    }
    return this._instances[name];
  }
}

// Export singleton instance
const container = new Container();

module.exports = container;
