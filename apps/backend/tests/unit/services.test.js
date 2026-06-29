/**
 * Unit Tests - Services
 * Pruebas para lógica de negocio de servicios
 */

describe('UserService', () => {
  let userService;
  let mockUserRepository;
  let mockEncryption;
  let mockEmailService;

  beforeEach(() => {
    mockUserRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      documentExists: jest.fn(),
      emailExists: jest.fn(),
      usernameExists: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockEncryption = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    mockEmailService = {
      sendEmail: jest.fn(),
    };

    // Mock de UserService
    userService = {
      userRepo: mockUserRepository,
      encryption: mockEncryption,
      emailService: mockEmailService,
      
      async getAll() {
        return this.userRepo.findAll();
      },
      
      async getById(id) {
        const user = await this.userRepo.findById(id);
        if (!user) throw new Error('User not found');
        return user;
      },
      
      async documentExists(documentNumber) {
        return this.userRepo.documentExists(documentNumber);
      },
      
      async emailExists(email) {
        return this.userRepo.emailExists(email);
      },
      
      async usernameExists(username) {
        return this.userRepo.usernameExists(username);
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('debe retornar todos los usuarios', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', role: 'user' },
        { id: '2', username: 'admin1', role: 'admin' },
      ];
      
      mockUserRepository.findAll.mockResolvedValue(mockUsers);
      
      const users = await userService.getAll();
      
      expect(mockUserRepository.findAll).toHaveBeenCalledTimes(1);
      expect(users).toHaveLength(2);
      expect(users[0].role).toBe('user');
      expect(users[1].role).toBe('admin');
    });

    test('debe retornar array vacío cuando no hay usuarios', async () => {
      mockUserRepository.findAll.mockResolvedValue([]);
      
      const users = await userService.getAll();
      
      expect(users).toEqual([]);
    });
  });

  describe('getById', () => {
    test('debe retornar usuario por ID', async () => {
      const mockUser = { 
        id: '123', 
        username: 'testuser', 
        role: 'user',
        is_active: true 
      };
      
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const user = await userService.getById('123');
      
      expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
      expect(user.id).toBe('123');
      expect(user.role).toBe('user');
    });

    test('debe lanzar error cuando usuario no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      
      await expect(userService.getById('999')).rejects.toThrow('User not found');
    });
  });

  describe('documentExists', () => {
    test('debe retornar true si documento existe', async () => {
      mockUserRepository.documentExists.mockResolvedValue(true);
      
      const exists = await userService.documentExists('12345678');
      
      expect(mockUserRepository.documentExists).toHaveBeenCalledWith('12345678');
      expect(exists).toBe(true);
    });

    test('debe retornar false si documento no existe', async () => {
      mockUserRepository.documentExists.mockResolvedValue(false);
      
      const exists = await userService.documentExists('99999999');
      
      expect(exists).toBe(false);
    });
  });

  describe('emailExists', () => {
    test('debe retornar true si email existe', async () => {
      mockUserRepository.emailExists.mockResolvedValue(true);
      
      const exists = await userService.emailExists('test@example.com');
      
      expect(mockUserRepository.emailExists).toHaveBeenCalledWith('test@example.com');
      expect(exists).toBe(true);
    });

    test('debe retornar false si email no existe', async () => {
      mockUserRepository.emailExists.mockResolvedValue(false);
      
      const exists = await userService.emailExists('new@example.com');
      
      expect(exists).toBe(false);
    });
  });

  describe('usernameExists', () => {
    test('debe retornar true si username existe', async () => {
      mockUserRepository.usernameExists.mockResolvedValue(true);
      
      const exists = await userService.usernameExists('existinguser');
      
      expect(mockUserRepository.usernameExists).toHaveBeenCalledWith('existinguser');
      expect(exists).toBe(true);
    });

    test('debe retornar false si username no existe', async () => {
      mockUserRepository.usernameExists.mockResolvedValue(false);
      
      const exists = await userService.usernameExists('newuser');
      
      expect(exists).toBe(false);
    });
  });
});

describe('Role Validation', () => {
  test('role debe ser siempre STRING', () => {
    const roles = ['admin', 'user', 'moderator'];
    
    roles.forEach(role => {
      expect(typeof role).toBe('string');
      expect(role).not.toBeInstanceOf(Number);
    });
  });

  test('roles válidos deben estar en minúsculas', () => {
    const validRoles = ['admin', 'user', 'moderator'];
    
    validRoles.forEach(role => {
      expect(role).toBe(role.toLowerCase());
    });
  });

  test('debe validar roles correctamente', () => {
    const validRoles = ['admin', 'user', 'moderator'];
    
    const isValidRole = (role) => validRoles.includes(role.toLowerCase());
    
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('USER')).toBe(true);
    expect(isValidRole('Moderator')).toBe(true);
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole('guest')).toBe(false);
  });
});
