const ResponseUtil = require('../../../src/shared/utils/response.util');

describe('ResponseUtil', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('success', () => {
    test('should send success response with data', () => {
      const data = { id: 1, name: 'Test' };
      ResponseUtil.success(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: true,
        message: 'Operation successful',
        data,
      });
      expect(jsonCall).toHaveProperty('timestamp');
      expect(new Date(jsonCall.timestamp)).toBeInstanceOf(Date);
    });

    test('should use custom status code', () => {
      ResponseUtil.success(mockRes, { id: 1 }, 'Success', 201);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('timestamp');
    });

    test('should include optional message', () => {
      const data = { id: 1 };
      const message = 'Created successfully';
      ResponseUtil.success(mockRes, data, message);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: true,
        data,
        message,
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });
  });

  describe('error', () => {
    test('should send error response', () => {
      const message = 'Something went wrong';
      ResponseUtil.error(mockRes, message, 400);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: false,
        message,
        code: 'VALIDATION_ERROR',
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });

    test('should use default status code 500', () => {
      ResponseUtil.error(mockRes, 'Error');
      expect(mockRes.status).toHaveBeenCalledWith(500);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall.code).toBe('INTERNAL_ERROR');
      expect(jsonCall).toHaveProperty('timestamp');
    });

    test('should include optional errors object', () => {
      const errors = { field: 'Invalid value' };
      ResponseUtil.error(mockRes, 'Validation failed', 400, 'VALIDATION_ERROR', errors);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });
  });

  describe('paginated', () => {
    test('should send paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const paginationData = {
        data,
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      };

      ResponseUtil.paginated(mockRes, paginationData);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: true,
        message: 'Data retrieved successfully',
        data,
        pagination: {
          currentPage: 1,
          pageSize: 10,
          totalItems: 100,
          totalPages: 10,
          hasNext: true,
          hasPrev: false,
        },
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });

    test('should include optional message', () => {
      const data = [{ id: 1 }];
      const paginationData = {
        data,
        page: 5,
        limit: 10,
        total: 50,
        totalPages: 5,
      };
      const message = 'Retrieved successfully';

      ResponseUtil.paginated(mockRes, paginationData, message);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: true,
        message,
        data,
        pagination: {
          currentPage: 5,
          pageSize: 10,
          totalItems: 50,
          totalPages: 5,
          hasNext: false,
          hasPrev: true,
        },
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });
  });

  describe('created', () => {
    test('should send 201 created response', () => {
      const data = { id: 1, name: 'New Item' };
      ResponseUtil.created(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: true,
        message: 'Resource created successfully',
        data,
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });

    test('should include optional message', () => {
      const data = { id: 1 };
      const message = 'Resource created';
      ResponseUtil.created(mockRes, data, message);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).toMatchObject({
        success: true,
        data,
        message,
      });
      expect(jsonCall).toHaveProperty('timestamp');
    });
  });

  describe('noContent', () => {
    test('should send 204 no content response', () => {
      ResponseUtil.noContent(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });
  });
});
