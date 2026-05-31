/**
 * UserService unit tests
 *
 * Covers:
 * - Soft-delete filtering (deleted_at IS NULL via Op.is) in getAll, getAllPaginated
 * - delete() sets both is_active=false AND deleted_at=<Date>
 * - Core CRUD operations
 * - Authentication helpers
 */

// ─── Mock shared/utils (appCache, cacheKeys, StringUtil) ────────────────────
jest.mock('../../../src/shared/utils', () => ({
  appCache: {
    getOrSet: jest.fn(),
    delete: jest.fn(),
    deletePattern: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
  cacheKeys: {
    user: jest.fn((id) => `user:${id}`),
    userByEmail: jest.fn((email) => `user:email:${email}`),
    users: jest.fn((filters) => `users:${JSON.stringify(filters)}`),
  },
  StringUtil: {
    generateRandomPassword: jest.fn(() => 'Random@Pass1'),
    generateUUID: jest.fn(() => 'mock-uuid-1234'),
  },
}));

// We need the instance after mocking so we can restore implementations in beforeEach
const { appCache, StringUtil } = require('../../../src/shared/utils');

// Op.is is a Symbol — import to assert the exact value the service passes to SQL
const { Op } = require('sequelize');

// ─── Repository mock ──────────────────────────────────────────────────────────
const mockUserRepository = {
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findByGoogleId: jest.fn(),
  findById: jest.fn(),
  findDeleted: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  emailExists: jest.fn(),
  usernameExists: jest.fn(),
  count: jest.fn(),
};

const mockEncryptionUtil = {
  hash: jest.fn(),
  compare: jest.fn(),
};

const UserService = require('../../../src/domain/services/user.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id: 'user-1',
  user_id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user',
  is_active: true,
  deleted_at: null,
  password_hash: '$2b$10$hashed',
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  restore: jest.fn().mockResolvedValue(true),
  ...overrides,
});

// Helper: verifica que un campo usa el operador IS NULL de Sequelize
const isNullFilter = { [Op.is]: null };

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('UserService', () => {
  let userService;

  beforeEach(() => {
    jest.clearAllMocks();
    // resetMocks:true in jest.config wipes implementations — restore them here
    appCache.getOrSet.mockImplementation((key, fn) => fn());
    StringUtil.generateRandomPassword.mockReturnValue('Random@Pass1');
    StringUtil.generateUUID.mockReturnValue('mock-uuid-1234');
    userService = new UserService(mockUserRepository, mockEncryptionUtil, null);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOFT-DELETE FILTERING
  // Verifica que los métodos de listado pasan WHERE "deleted_at" IS NULL
  // usando el operador Op.is de Sequelize (genera SQL IS NULL en PostgreSQL)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Soft-delete filtering', () => {
    describe('getAllPaginated', () => {
      beforeEach(() => {
        mockUserRepository.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
      });

      test('pasa deleted_at: { [Op.is]: null } en el where por defecto', async () => {
        await userService.getAllPaginated();

        const [, options] = mockUserRepository.findAndCountAll.mock.calls[0];
        expect(options.where.deleted_at).toEqual(isNullFilter);
      });

      test('combina filtro IS NULL con is_active', async () => {
        await userService.getAllPaginated({ is_active: true });

        const [, options] = mockUserRepository.findAndCountAll.mock.calls[0];
        expect(options.where.deleted_at).toEqual(isNullFilter);
        expect(options.where.is_active).toBe(true);
      });

      test('combina filtro IS NULL con búsqueda de texto (Op.or con iLike)', async () => {
        await userService.getAllPaginated({ search: 'carlos' });

        const [, options] = mockUserRepository.findAndCountAll.mock.calls[0];
        expect(options.where.deleted_at).toEqual(isNullFilter);
        // Op.or es un Symbol — debe existir en los keys simbólicos del where
        const symbolKeys = Object.getOwnPropertySymbols(options.where);
        expect(symbolKeys).toContain(Op.or);
      });

      test('NO devuelve filas con deleted_at != null — simulación de filtrado', async () => {
        const activeUser  = makeUser({ id: 'a1', deleted_at: null });
        const deletedUser = makeUser({ id: 'd1', deleted_at: new Date('2026-01-01') });

        // La implementación real filtra en BD; simulamos: solo pasan los que tienen deleted_at null
        mockUserRepository.findAndCountAll.mockImplementation(() => {
          const rows = [activeUser, deletedUser].filter(u => u.deleted_at === null);
          return Promise.resolve({ rows, count: rows.length });
        });

        const result = await userService.getAllPaginated();

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].id).toBe('a1');
        expect(result.rows.find(u => u.id === 'd1')).toBeUndefined();
      });

      test('devuelve estructura de paginación correcta', async () => {
        mockUserRepository.findAndCountAll.mockResolvedValue({ rows: [makeUser()], count: 1 });

        const result = await userService.getAllPaginated({}, { page: 2, limit: 5 });

        expect(result).toMatchObject({ total: 1, page: 2, pages: 1, limit: 5 });
        const [pagination] = mockUserRepository.findAndCountAll.mock.calls[0];
        expect(pagination).toMatchObject({ limit: 5, offset: 5 });
      });
    });

    describe('getAll', () => {
      test('pasa deleted_at: { [Op.is]: null } en el where por defecto', async () => {
        mockUserRepository.findAll.mockResolvedValue([]);

        await userService.getAll();

        const { where } = mockUserRepository.findAll.mock.calls[0][0];
        expect(where.deleted_at).toEqual(isNullFilter);
      });

      test('combina filtro IS NULL con is_active', async () => {
        mockUserRepository.findAll.mockResolvedValue([]);

        await userService.getAll({ is_active: false });

        const { where } = mockUserRepository.findAll.mock.calls[0][0];
        expect(where.deleted_at).toEqual(isNullFilter);
        expect(where.is_active).toBe(false);
      });
    });

    describe('delete (baja lógica)', () => {
      test('establece is_active=false Y deleted_at con una fecha', async () => {
        const user = makeUser();
        mockUserRepository.findById.mockResolvedValue(user);

        const result = await userService.delete('user-1');

        expect(result).toBe(true);
        expect(user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            is_active: false,
            deleted_at: expect.any(Date),
          })
        );
      });

      test('devuelve false cuando el usuario no existe', async () => {
        mockUserRepository.findById.mockResolvedValue(null);

        const result = await userService.delete('nonexistent');

        expect(result).toBe(false);
      });

      test('NOT llama a update si el usuario no existe', async () => {
        mockUserRepository.findById.mockResolvedValue(null);

        await userService.delete('nonexistent');

        // Ningún user mock, no se puede haber llamado update
        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getByEmail', () => {
    test('retorna el usuario cuando existe', async () => {
      const user = makeUser();
      mockUserRepository.findByEmail.mockResolvedValue(user);

      const result = await userService.getByEmail('test@example.com');

      expect(result).toEqual(user);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    test('retorna null cuando no existe', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.getByEmail('no@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    test('retorna el usuario cuando existe', async () => {
      const user = makeUser();
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await userService.getById('user-1');

      expect(result).toEqual(user);
    });

    test('lanza NotFoundError cuando no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getById('ghost')).rejects.toThrow();
    });
  });

  describe('create', () => {
    test('crea usuario con contraseña hasheada', async () => {
      const userData = {
        email: 'new@example.com',
        username: 'newuser',
        password_hash: 'PlainPass@1',
        role: 'user',
      };
      const hashed = '$2b$10$hashed';
      const created = makeUser({ ...userData, password_hash: hashed });

      mockEncryptionUtil.hash.mockResolvedValue(hashed);
      mockUserRepository.create.mockResolvedValue(created);

      await userService.create(userData);

      expect(mockEncryptionUtil.hash).toHaveBeenCalledWith('PlainPass@1');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email,
          username: userData.username,
          password_hash: hashed,
        })
      );
    });

    test('genera contraseña aleatoria si no se provee', async () => {
      const userData = { email: 'auto@example.com', username: 'autouser', role: 'user' };
      const created = makeUser(userData);

      mockEncryptionUtil.hash.mockResolvedValue('$2b$10$auto');
      mockUserRepository.create.mockResolvedValue(created);

      await userService.create(userData);

      // StringUtil.generateRandomPassword fue mockeado arriba — debe haberse hasheado su resultado
      expect(mockEncryptionUtil.hash).toHaveBeenCalledWith('Random@Pass1');
    });
  });

  describe('update', () => {
    test('actualiza correctamente sin modificar email/username', async () => {
      const user = makeUser();
      mockUserRepository.findById.mockResolvedValue(user);

      await userService.update('user-1', { role: 'moderator', email: 'NEW@x.com', username: 'hacked' });

      const updateArg = user.update.mock.calls[0][0];
      expect(updateArg).toHaveProperty('role', 'moderator');
      expect(updateArg).not.toHaveProperty('email');
      expect(updateArg).not.toHaveProperty('username');
    });

    test('hashea la nueva contraseña si se envía', async () => {
      const user = makeUser();
      const newHashed = '$2b$10$newhash';
      mockUserRepository.findById.mockResolvedValue(user);
      mockEncryptionUtil.hash.mockResolvedValue(newHashed);

      await userService.update('user-1', { password_hash: 'NewPass@1' });

      expect(mockEncryptionUtil.hash).toHaveBeenCalledWith('NewPass@1');
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({ password_hash: newHashed })
      );
    });
  });

  describe('toggleActive', () => {
    test('actualiza is_active al valor dado', async () => {
      const user = makeUser();
      mockUserRepository.findById.mockResolvedValue(user);

      await userService.toggleActive('user-1', false);

      expect(user.update).toHaveBeenCalledWith({ is_active: false });
    });
  });

  describe('emailExists / usernameExists', () => {
    test('emailExists delega al repositorio', async () => {
      mockUserRepository.emailExists.mockResolvedValue(true);

      const exists = await userService.emailExists('taken@example.com');

      expect(exists).toBe(true);
      expect(mockUserRepository.emailExists).toHaveBeenCalledWith('taken@example.com');
    });

    test('usernameExists delega al repositorio', async () => {
      mockUserRepository.usernameExists.mockResolvedValue(false);

      const exists = await userService.usernameExists('available');

      expect(exists).toBe(false);
      expect(mockUserRepository.usernameExists).toHaveBeenCalledWith('available');
    });
  });
});
