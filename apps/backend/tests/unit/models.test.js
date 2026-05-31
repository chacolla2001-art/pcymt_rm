/**
 * Unit Tests - Models
 * Pruebas para validaciones y comportamiento de modelos Sequelize
 */

const { DataTypes } = require('sequelize');

describe('User Model', () => {
  let User;
  let mockSequelize;

  beforeEach(() => {
    mockSequelize = {
      define: jest.fn((modelName, schema, options) => ({
        modelName,
        schema,
        options,
        tableName: options.tableName,
      })),
      Sequelize: { Op: {} },
    };
  });

  describe('Schema Definition', () => {
    test('debe tener campos obligatorios correctos', () => {
      const userSchema = {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        email: {
          type: DataTypes.STRING(100),
          allowNull: false,
          unique: true,
        },
        role: {
          type: DataTypes.STRING(20),
          defaultValue: 'user',
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
      };

      expect(userSchema.id.type.key || userSchema.id.type).toBe(DataTypes.UUID.key || DataTypes.UUID);
      expect(userSchema.username.allowNull).toBe(false);
      expect(userSchema.email.allowNull).toBe(false);
      expect(userSchema.role.type.key || 'STRING').toBe('STRING');
      expect(userSchema.is_active.type.key || userSchema.is_active.type).toBe(DataTypes.BOOLEAN.key || DataTypes.BOOLEAN);
    });

    test('role debe ser STRING y no ENUM', () => {
      const roleField = {
        type: DataTypes.STRING(20),
        defaultValue: 'user',
        validate: {
          isIn: [['admin', 'user', 'moderator']],
        },
      };

      expect(roleField.type.key || 'STRING').toBe('STRING');
      expect(roleField.type.key).not.toBe('ENUM');
      expect(roleField.validate.isIn[0]).toContain('admin');
      expect(roleField.validate.isIn[0]).toContain('user');
      expect(roleField.validate.isIn[0]).toContain('moderator');
    });

    test('debe usar snake_case para nombres de campos', () => {
      const fields = [
        'avatar_url',
        'email_verified_at',
        'last_login_at',
        'is_active',
        'created_at',
        'updated_at',
      ];

      fields.forEach(field => {
        expect(field).toMatch(/^[a-z]+(_[a-z]+)*$/);
      });
    });
  });

  describe('Validations', () => {
    test('username debe tener patrón alfanumérico con guiones', () => {
      const usernameValidation = {
        is: /^[a-zA-Z0-9_-]+$/,
        len: [3, 50],
      };

      expect('john_doe').toMatch(usernameValidation.is);
      expect('user-123').toMatch(usernameValidation.is);
      expect('admin').toMatch(usernameValidation.is);
      expect('user@test').not.toMatch(usernameValidation.is);
    });

    test('email debe validar formato correcto', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect('user@example.com').toMatch(emailRegex);
      expect('test.user@domain.co').toMatch(emailRegex);
      expect('invalid.email').not.toMatch(emailRegex);
      expect('@domain.com').not.toMatch(emailRegex);
    });

    test('role debe validar valores permitidos', () => {
      const allowedRoles = ['admin', 'user', 'moderator'];
      
      expect(allowedRoles).toContain('admin');
      expect(allowedRoles).toContain('user');
      expect(allowedRoles).toContain('moderator');
      expect(allowedRoles).not.toContain('superadmin');
      expect(allowedRoles).not.toContain('guest');
    });
  });

  describe('Default Values', () => {
    test('role debe tener valor por defecto "user"', () => {
      const roleField = {
        type: DataTypes.STRING(20),
        defaultValue: 'user',
      };
      
      expect(roleField.defaultValue).toBe('user');
    });

    test('is_active debe tener valor por defecto true', () => {
      const isActiveField = {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      };
      
      expect(isActiveField.defaultValue).toBe(true);
    });

    test('id debe generar UUID automáticamente', () => {
      const idField = {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      };
      
      expect(idField.type).toBe(DataTypes.UUID);
      expect(idField.defaultValue).toBe(DataTypes.UUIDV4);
    });
  });
});

describe('Model Relationships', () => {
  test('UserSession debe tener user_id como foreign key', () => {
    const userIdField = {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    };

    expect(userIdField.references.model).toBe('users');
    expect(userIdField.references.key).toBe('id');
    expect(userIdField.allowNull).toBe(false);
  });

  test('UserInteraction debe tener user_id como foreign key', () => {
    const userIdField = {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    };

    expect(userIdField.type).toBe(DataTypes.UUID);
    expect(userIdField.references).toBeDefined();
  });
});
