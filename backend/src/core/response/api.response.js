const { HTTP_STATUS } = require('../../shared/constants/status');

class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = HTTP_STATUS.OK) {
    const body = { success: true, message };
    if (data !== null) body.data = data;
    return res.status(statusCode).json(body);
  }

  static created(res, data, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message,
      data,
      pagination,
    });
  }

  static error(res, message = 'Something went wrong', statusCode = HTTP_STATUS.INTERNAL_ERROR, code = null) {
    const body = { success: false, message };
    if (code) body.code = code;
    return res.status(statusCode).json(body);
  }
}

module.exports = { ApiResponse };
