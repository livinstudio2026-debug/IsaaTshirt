export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
  static notFound(message = 'Not found') { return new ApiError(404, message) }
}
