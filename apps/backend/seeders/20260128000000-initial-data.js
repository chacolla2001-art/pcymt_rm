"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    
    // Security: Use environment variable for initial admin password
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Cybercenter1';
    const hashedPassword = await bcrypt.hash(initialPassword, 10);
    
    // Warn if using default password
    if (!process.env.INITIAL_ADMIN_PASSWORD) {
      console.warn('⚠️  WARNING: Using default admin password. Set INITIAL_ADMIN_PASSWORD in .env');
    }

    // ============================================
    // 1. VIRTUAL ASSETS - 12 modelos con sus iconos
    // ============================================
    const virtualAssets = [
      {
        id: "660e8400-e29b-41d4-a716-446655440001",
        name: "Oso Andino",
        scientific_name: "Tremarctos ornatus",
        description: "El oso de anteojos es el único oso de Sudamérica. Habita los bosques nublados y páramos de los Andes bolivianos. Es un animal solitario y principalmente herbívoro.",
        category: "Mamífero",
        habitat: "Bosque nublado andino",
        model_url: "/api/files/bear.glb",
        icon_url: "/api/files/bear.png",
        display_order: 1,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440002",
        name: "Toro",
        scientific_name: "Bos taurus",
        description: "El ganado bovino fue introducido en Bolivia durante la colonia. Es fundamental en la economía agrícola de los valles y tierras bajas, utilizado para trabajo y producción.",
        category: "Mamífero",
        habitat: "Valles interandinos",
        model_url: "/api/files/cattle.glb",
        icon_url: "/api/files/cattle.png",
        display_order: 2,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440003",
        name: "Gallina",
        scientific_name: "Gallus gallus domesticus",
        description: "Ave doméstica criada en los valles bolivianos desde tiempos coloniales. Es parte esencial de la alimentación y economía familiar en comunidades rurales.",
        category: "Ave",
        habitat: "Valles templados",
        model_url: "/api/files/chicken.glb",
        icon_url: "/api/files/chicken.png",
        display_order: 3,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440004",
        name: "Vaca Lechera",
        scientific_name: "Bos taurus",
        description: "El ganado lechero de los valles de Cochabamba y Tarija produce lácteos de alta calidad. Las razas criollas se han adaptado a la altura y clima andino.",
        category: "Mamífero",
        habitat: "Valles de Cochabamba",
        model_url: "/api/files/cow.glb",
        icon_url: "/api/files/cow.png",
        display_order: 4,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440005",
        name: "Perro Criollo",
        scientific_name: "Canis lupus familiaris",
        description: "El perro boliviano o criollo es compañero del hombre andino desde hace miles de años. Es guardián de rebaños y hogares en comunidades de valles y altiplano.",
        category: "Mamífero",
        habitat: "Valles y comunidades",
        model_url: "/api/files/dog.glb",
        icon_url: "/api/files/dog.png",
        display_order: 5,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440006",
        name: "Caballo Criollo",
        scientific_name: "Equus ferus caballus",
        description: "El caballo criollo boliviano desciende de los caballos españoles. Es utilizado para transporte, trabajo agrícola y festividades tradicionales en los valles.",
        category: "Mamífero",
        habitat: "Valles y llanos",
        model_url: "/api/files/horse.glb",
        icon_url: "/api/files/horse.png",
        display_order: 6,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440007",
        name: "Jaguar",
        scientific_name: "Panthera onca",
        description: "El jaguar es el felino más grande de América. En Bolivia habita las selvas del Madidi y Beni. Es considerado sagrado en la cosmovisión andina y amazónica.",
        category: "Mamífero",
        habitat: "Selva amazónica",
        model_url: "/api/files/leopard.glb",
        icon_url: "/api/files/leopard.png",
        display_order: 7,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440008",
        name: "Lagarto Tegu",
        scientific_name: "Salvator merianae",
        description: "El lagarto tegu habita las tierras bajas de Bolivia. Es el lagarto más grande de Sudamérica y juega un rol importante en el control de plagas.",
        category: "Reptil",
        habitat: "Llanos orientales",
        model_url: "/api/files/lizard.glb",
        icon_url: "/api/files/lizard.png",
        display_order: 8,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440009",
        name: "Sirena del Titicaca",
        scientific_name: "Mythologica lacustris",
        description: "Según la leyenda aymara, las sirenas habitan las profundidades del Lago Titicaca. Atraen a los pescadores con su canto y protegen los tesoros sumergidos.",
        category: "Mito",
        habitat: "Lago Titicaca",
        model_url: "/api/files/mermaid.glb",
        icon_url: "/api/files/mermaid.png",
        display_order: 9,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440010",
        name: "Chancho Criollo",
        scientific_name: "Sus scrofa domesticus",
        description: "El cerdo criollo boliviano es criado en los valles para consumo familiar. Es protagonista de platos tradicionales como el chicharrón y fricasé.",
        category: "Mamífero",
        habitat: "Valles templados",
        model_url: "/api/files/pig.glb",
        icon_url: "/api/files/pig.png",
        display_order: 10,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440011",
        name: "Puma",
        scientific_name: "Puma concolor",
        description: "El puma o león de montaña habita desde los Andes hasta la Amazonía boliviana. Es símbolo de fuerza en la cultura andina y está protegido por ley.",
        category: "Mamífero",
        habitat: "Bosques y montañas",
        model_url: "/api/files/tiger.glb",
        icon_url: "/api/files/tiger.png",
        display_order: 11,
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440012",
        name: "Víbora Cascabel",
        scientific_name: "Crotalus durissus",
        description: "La cascabel sudamericana habita los llanos orientales de Bolivia. Su veneno es usado en medicina tradicional y es respetada por las comunidades locales.",
        category: "Reptil",
        habitat: "Llanos y Chaco",
        model_url: "/api/files/viper.glb",
        icon_url: "/api/files/viper.png",
        display_order: 12,
      },
    ];

    await queryInterface.bulkInsert("virtual_assets", virtualAssets.map((a) => ({
      ...a,
      thumbnail_url: a.icon_url,
      is_active: true,
      created_at: now,
      updated_at: now,
    })));

    // ============================================
    // 2. USERS - Usuario principal y otros
    // ============================================
    const users = [
      { id: "550e8400-e29b-41d4-a716-446655440001", name: "Pedro Chacolla",     email: "chacolla43@gmail.com",           role: "admin" },
      { id: "550e8400-e29b-41d4-a716-446655440002", name: "Carlos Ramirez",     email: "candramgar@gmail.com",           role: "admin" },
    ];

    // Asignar avatares de los virtual assets a usuarios
    const avatarIcons = [
      "/api/files/bear.png",      // Oso Andino
      "/api/files/cattle.png",    // Toro
      "/api/files/chicken.png",   // Gallina
      "/api/files/cow.png",       // Vaca
      "/api/files/dog.png",       // Perro
      "/api/files/horse.png",     // Caballo
      "/api/files/leopard.png",   // Jaguar
      "/api/files/lizard.png",    // Lagarto
      "/api/files/mermaid.png",   // Sirena
      "/api/files/pig.png",       // Chancho
      "/api/files/tiger.png",     // Puma
      "/api/files/viper.png",     // Víbora
    ];

    await queryInterface.bulkInsert("users", users.map((u, i) => ({
      ...u,
      password_hash: hashedPassword,
      google_id: null, // Google OAuth ID - initially null for seeded users
      is_active: true,
      avatar_url: avatarIcons[i % avatarIcons.length],
      email_verified_at: now,
      last_login_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      created_at: now,
      updated_at: now,
    })));

    // ============================================
    // 3. LOCATIONS (Anchor Points) - Parque de las Culturas y la Madre Tierra
    // Coordenadas GPS precisas dentro del polígono del parque
    // Bounds del parque: Lat [-16.4921, -16.4866], Lng [-68.1469, -68.1446]
    // ============================================
    const locations = [
      // TIERRAS ALTAS - Zona noroeste del parque (cerca de la entrada)
      {
        id: "770e8400-e29b-41d4-a716-446655440001",
        name: "Mirador del Oso Andino",
        latitude: -16.48720000,
        longitude: -68.14620000,
        section: "Tierras Altas",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440001", // Oso Andino
      },

      // TIERRAS MEDIAS - Zona central del parque (Valles)
      {
        id: "770e8400-e29b-41d4-a716-446655440002",
        name: "Corral del Toro",
        latitude: -16.48850000,
        longitude: -68.14560000,
        section: "Tierras Medias",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440002", // Toro
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440003",
        name: "Gallinero Tradicional",
        latitude: -16.48880000,
        longitude: -68.14530000,
        section: "Tierras Medias",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440003", // Gallina
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440004",
        name: "Establo Lechero",
        latitude: -16.48920000,
        longitude: -68.14550000,
        section: "Tierras Medias",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440004", // Vaca
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440005",
        name: "Caseta del Guardián",
        latitude: -16.48950000,
        longitude: -68.14540000,
        section: "Tierras Medias",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440005", // Perro
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440006",
        name: "Caballeriza Criolla",
        latitude: -16.48980000,
        longitude: -68.14520000,
        section: "Tierras Medias",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440006", // Caballo
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440010",
        name: "Chiquero del Valle",
        latitude: -16.49010000,
        longitude: -68.14500000,
        section: "Tierras Medias",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440010", // Chancho
      },

      // TIERRAS BAJAS - Zona sureste del parque (Llanos)
      {
        id: "770e8400-e29b-41d4-a716-446655440007",
        name: "Territorio del Jaguar",
        latitude: -16.49050000,
        longitude: -68.14480000,
        section: "Tierras Bajas",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440007", // Jaguar
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440008",
        name: "Zona de Reptiles",
        latitude: -16.49080000,
        longitude: -68.14490000,
        section: "Tierras Bajas",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440008", // Lagarto
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440011",
        name: "Refugio del Puma",
        latitude: -16.49110000,
        longitude: -68.14510000,
        section: "Tierras Bajas",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440011", // Puma
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440012",
        name: "Serpentario",
        latitude: -16.49140000,
        longitude: -68.14520000,
        section: "Tierras Bajas",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440012", // Víbora
      },

      // MITOS Y LEYENDAS - Zona especial (área oeste con lago)
      {
        id: "770e8400-e29b-41d4-a716-446655440009",
        name: "Lago de las Sirenas",
        latitude: -16.48780000,
        longitude: -68.14660000,
        section: "Mitos y Leyendas",
        virtual_asset_id: "660e8400-e29b-41d4-a716-446655440009", // Sirena
      },
    ];

    await queryInterface.bulkInsert("locations", locations.map((l, i) => ({
      ...l,
      anchor_code: `PCM-${l.section.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      show_in_map: true,
      scale: parseFloat((0.8 + Math.random() * 0.4).toFixed(1)),
      rotation_y: Math.floor(Math.random() * 360),
      is_active: true,
      created_at: now,
      updated_at: now,
    })));

    // ============================================
    // 6. MAP CONFIGURATIONS - Configuración por defecto del mapa web
    // Escala inicial: 1.2 | Rotación: -52° (-0.9076 rad)
    // Stickers de los 12 puntos de interés del parque
    // ============================================
    const defaultMapConfig = {
      mapState: {
        scale: 1.2,
        rotation: -52 * Math.PI / 180, // -0.9076 rad ≈ -52°
        offsetX: 0,
        offsetY: 0,
        showGrid: true,
        showSections: true,
        showLabels: true,
        showBoundary: true,
      },
      stickerLayers: [
        {
          id: "layer-default-001",
          name: "Puntos de Interés",
          visible: true,
          stickers: [
            // Tierras Altas
            { stickerKey: "mirador",            lat: -16.48720000, lng: -68.14620000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "piedrasaltas",       lat: -16.48760000, lng: -68.14608000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "plantascactus",      lat: -16.48800000, lng: -68.14600000, scale: 1.0, rotation: 0, opacity: 1.0 },
            // Tierras Medias
            { stickerKey: "casita",             lat: -16.48850000, lng: -68.14560000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "galpon",             lat: -16.48880000, lng: -68.14530000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "estanque",           lat: -16.48920000, lng: -68.14550000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "casitahexagonal",    lat: -16.48950000, lng: -68.14540000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "juegos",             lat: -16.48980000, lng: -68.14520000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "chiwina",            lat: -16.49010000, lng: -68.14500000, scale: 1.0, rotation: 0, opacity: 1.0 },
            // Tierras Bajas
            { stickerKey: "anfiteatro",         lat: -16.49050000, lng: -68.14480000, scale: 1.0, rotation: 0, opacity: 1.0 },
            { stickerKey: "lagotiticaca",       lat: -16.49080000, lng: -68.14490000, scale: 1.0, rotation: 0, opacity: 1.0 },
            // Mitos y Leyendas
            { stickerKey: "puertadelsol",       lat: -16.49110000, lng: -68.14520000, scale: 1.0, rotation: 0, opacity: 1.0 },
          ],
        },
      ],
    };

    await queryInterface.bulkInsert("map_configurations", [
      {
        id: "aa0e8400-e29b-41d4-a716-446655440001",
        user_id: "550e8400-e29b-41d4-a716-446655440001", // admin: chacolla43
        name: "Configuración por defecto",
        description: "Vista inicial del Parque de las Culturas y la Madre Tierra con stickers en los 12 puntos de interés",
        platform: "web",
        config_data: JSON.stringify(defaultMapConfig),
        is_public: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    console.log("[SEED] ✅ Datos iniciales insertados exitosamente:");
    console.log("  - 12 modelos 3D (Virtual Assets)");
    console.log("  - 15 usuarios (admin: chacolla43@gmail.com / Cybercenter1)");
    console.log("  - 12 puntos de anclaje (4 secciones: Tierras Altas, Tierras Medias, Tierras Bajas, Mitos y Leyendas)");
    console.log("  - 1 configuración de mapa por defecto (web, pública)");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("sessions", null, {});
    await queryInterface.bulkDelete("locations", null, {});
    await queryInterface.bulkDelete("virtual_assets", null, {});
    await queryInterface.bulkDelete("users", null, {});
    await queryInterface.bulkDelete("map_configurations", null, {});
    console.log("[SEED] ✅ Datos iniciales eliminados");
  },
};
