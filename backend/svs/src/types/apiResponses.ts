/**
 * API response structure for all endpoints.
 * @param <T>  Type of data being returned in the response.
 * @property {T | null} data -  Response Payload; null if an error occurs.
 * @property {string | null} error - Error message; null if successful.
 * @property {any[]} details - Optional. Details about errors (e.g. validation errors).
 */
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  details?: any[]
}
